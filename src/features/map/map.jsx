import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './map.css';
import UploadScreen from './UploadScreen';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { API_BASE_URL, fetchPins, fetchStreetNameFromCoordinates, renderPinsOnMap, uploadForm } from './api';

const position = [-23.61868, -46.645];
const DEBOUNCE_MS = 400;

function MapScreen() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [pinDetails, setPinDetails] = useState({
    open: false,
    streetName: '',
    info: '',
    imageDate: '',
    imageUrl: '',
    message: '',
  });
  const [successNotice, setSuccessNotice] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const lastPopupRef = useRef(null);
  const debounceRef = useRef(null);

  const fetchAddress = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await response.json();
      const addr = data.address || {};

      const rua = addr.road || 'Rua desconhecida';
      const numero = addr.house_number || 'S/N';
      const cep = addr.postcode || 'CEP não disponível';
      const bairro = addr.neighbourhood || addr.suburb || 'Bairro não disponível';
      const cidade = addr.city || addr.town || 'Cidade não disponível';
      const estado = addr.state || 'Estado não disponível';

      const formattedAddress = `${rua}, ${numero} - ${bairro}, ${cidade} - ${estado}, CEP: ${cep}`;
      setSelectedAddress(formattedAddress);
    } catch (error) {
      console.error('Erro ao buscar endereço:', error);
      setSelectedAddress('Endereço não disponível');
    }
  };

  const loadPinsForBounds = useCallback(async () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const bounds = map.getBounds();
    const minLat = bounds.getSouth();
    const maxLat = bounds.getNorth();
    const minLng = bounds.getWest();
    const maxLng = bounds.getEast();

    try {
      const pins = await fetchPins(minLat, maxLat, minLng, maxLng);
      renderPinsOnMap(map, pins, {
        onPinClick: async (pin) => {
          const streetName = pin.fullAddress || pin.address || await fetchStreetNameFromCoordinates(pin.latitude, pin.longitude);

          setPinDetails({
            open: true,
            streetName,
            info: pin.info,
            imageDate: pin.imageDate,
            imageUrl: '',
            message: 'Carregando imagem…',
          });

          try {
            const response = await fetch(`${API_BASE_URL}/api/images/${pin.id}`, {
              cache: 'no-store',
            });

            if (!response.ok) {
              throw new Error('Imagem indisponível');
            }

            const contentType = response.headers.get('content-type') || '';
            const rawBlob = await response.blob();

            if (contentType.includes('application/json')) {
              const payload = JSON.parse(await rawBlob.text());
              if (payload && typeof payload.imageUrl === 'string') {
                setPinDetails({
                  open: true,
                  streetName,
                  info: pin.info,
                  imageDate: pin.imageDate,
                  imageUrl: payload.imageUrl,
                  message: '',
                });
                return;
              }
            }

            if (!rawBlob.type || rawBlob.type.startsWith('image/')) {
              const readableImageUrl = URL.createObjectURL(rawBlob);
              setPinDetails({
                open: true,
                streetName,
                info: pin.info,
                imageDate: pin.imageDate,
                imageUrl: readableImageUrl,
                message: '',
              });
              return;
            }

            throw new Error('Imagem indisponível');
          } catch (error) {
            setPinDetails({
              open: true,
              streetName,
              info: pin.info,
              imageDate: pin.imageDate,
              imageUrl: '',
              message: 'Imagem não disponível no momento. Use os detalhes do registro para mais informações.',
            });
          }
        },
      });
    } catch (error) {
      console.error('Erro ao buscar pins:', error);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = L.map(mapRef.current, {
      center: position,
      zoom: 14,
      zoomControl: true,
      attributionControl: false,
    });
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '',
    }).addTo(map);

    const markerIcon = L.icon({
      iconUrl,
      iconRetinaUrl,
      shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [0, -120],
      shadowSize: [41, 41],
    });

    const popup = L.popup({
      closeButton: true,
      autoClose: true,
      closeOnClick: false,
      minWidth: 280,
      maxWidth: 280,
    });

    const handleMapBounds = () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        loadPinsForBounds();
      }, DEBOUNCE_MS);
    };

    map.on('moveend zoomend', handleMapBounds);
    map.on('click', async (event) => {
      const clickedElement = event.originalEvent?.target;
      if (
        clickedElement &&
        typeof clickedElement.closest === 'function' &&
        (
          clickedElement.closest('.leaflet-marker-icon') ||
          clickedElement.closest('.leaflet-popup-content-wrapper') ||
          clickedElement.closest('.leaflet-popup-content')
        )
      ) {
        return;
      }

      const { latlng } = event;

      if (markerRef.current) {
        map.removeLayer(markerRef.current);
      }

      markerRef.current = L.marker(latlng, { icon: markerIcon, draggable: true }).addTo(map);

      markerRef.current.on('dragend', () => {
        const newLatLng = markerRef.current.getLatLng();
        setSelectedLocation(newLatLng);
        fetchAddress(newLatLng.lat, newLatLng.lng);
      });

      markerRef.current.on('drag', () => {
        if (popup.isOpen()) {
          popup.setLatLng(markerRef.current.getLatLng());
        }
      });

      const container = L.DomUtil.create('div', 'popup-content');
      const message = L.DomUtil.create('div', 'popup-text', container);

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}`
        );
        const data = await response.json();
        const addr = data.address || {};

        const rua = addr.road || 'Rua desconhecida';
        const numero = addr.house_number || 'S/N';
        const cep = addr.postcode || 'CEP não disponível';
        const bairro = addr.neighbourhood || addr.suburb || 'Bairro não disponível';
        const cidade = addr.city || addr.town || 'Cidade não disponível';
        const estado = addr.state || 'Estado não disponível';

        message.innerHTML = `<strong>${rua}, ${numero}</strong><br/>${bairro}<br/>${cidade} - ${estado}<br/>CEP: ${cep}<br/>`;
      } catch (error) {
        console.error('Erro ao buscar endereço:', error);
        message.innerHTML = 'Clique no botão para marcar este local.';
      }

      const button = L.DomUtil.create('button', 'popup-button', container);
      button.textContent = 'Marcar local';

      L.DomEvent.on(button, 'click', (buttonEvent) => {
        L.DomEvent.stopPropagation(buttonEvent);
        setSelectedLocation(latlng);
        lastPopupRef.current = popup;
        fetchAddress(latlng.lat, latlng.lng);
        setShowForm(true);
      });

      popup.setLatLng(latlng).setContent(container).openOn(map);
    });

    loadPinsForBounds();

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      map.remove();
    };
  }, [loadPinsForBounds]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedLocation) {
      alert('Selecione um local primeiro.');
      return;
    }

    try {
      await uploadForm(
        photo,
        date,
        notes,
        selectedLocation.lat,
        selectedLocation.lng
      );

      if (markerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(markerRef.current);
        markerRef.current = null;
      }

      if (lastPopupRef.current && mapInstanceRef.current) {
        lastPopupRef.current.remove();
        lastPopupRef.current = null;
      }

      setSelectedLocation(null);
      setSelectedAddress('');
      setShowForm(false);
      setPhoto(null);
      setDate('');
      setNotes('');
      setPinDetails({ open: false, streetName: '', info: '', imageDate: '', imageUrl: '', message: '' });
      setSuccessNotice(true);
      await loadPinsForBounds();

      setTimeout(() => {
        setSuccessNotice(false);
      }, 3000);
    } catch (error) {
      alert(error.message || 'Não foi possível enviar o registro.');
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedLocation(null);
    setSelectedAddress('');
    setPhoto(null);
    setDate('');
    setNotes('');

    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 100);

    if (lastPopupRef.current && mapInstanceRef.current) {
      lastPopupRef.current.openOn(mapInstanceRef.current);
    }
  };

  const handlePhotoChange = (event) => {
    setPhoto(event.target.files?.[0] || null);
  };

  return (
    <div className="map-screen">
      <div ref={mapRef} className="map-fullscreen" style={{ display: showForm ? 'none' : 'block' }} />
      {showForm && (
        <UploadScreen
          onClose={handleCloseForm}
          onSubmit={handleSubmit}
          onPhotoChange={handlePhotoChange}
          date={date}
          setDate={setDate}
          notes={notes}
          setNotes={setNotes}
          selectedLocation={selectedLocation}
          selectedAddress={selectedAddress}
        />
      )}

      {successNotice && (
        <div className="success-toast">
          <strong>Ocorrência enviada com Sucesso</strong>
          <span>Obrigado por ajudar a melhorar a nossa cidade</span>
        </div>
      )}

      {pinDetails.open && (
        <div className="pin-details-backdrop" onClick={() => setPinDetails((current) => ({ ...current, open: false }))}>
          <div className="pin-details-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="pin-details-close" onClick={() => setPinDetails((current) => ({ ...current, open: false }))}>
              ✕
            </button>
            <h2>{pinDetails.streetName || 'Detalhes do ponto'}</h2>
            {pinDetails.info && <p className="pin-details-subtitle">{pinDetails.info}</p>}
            {pinDetails.imageDate && <p className="pin-details-date">Data: {pinDetails.imageDate}</p>}
            {pinDetails.imageUrl ? (
              <img src={pinDetails.imageUrl} alt={pinDetails.info || 'Imagem do ponto'} className="pin-details-image" />
            ) : (
              <div className="pin-details-placeholder">{pinDetails.message || 'Imagem indisponível para este registro.'}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MapScreen;
