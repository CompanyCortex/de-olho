import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './map.css';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

const position = [-23.61868, -46.6450];

function MapScreen() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const lastPopupRef = useRef(null);

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

  useEffect(() => {
    if (!mapRef.current) return;

    const map = L.map(mapRef.current, {
      center: position,
      zoom: 14,
      zoomControl: true,
      attributionControl: true,
    });
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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

    map.on('click', async (event) => {
      const { latlng } = event;
      
      // Remover marker anterior se existir
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
      }

      // Criar e adicionar marker imediatamente
      markerRef.current = L.marker(latlng, { icon: markerIcon, draggable: true })
        .addTo(map);

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
        
        message.innerHTML = `<strong>${rua}, ${numero}</strong><br/>
          ${bairro}<br/>
          ${cidade} - ${estado}<br/>
          CEP: ${cep}<br/>`;
      } catch (error) {
        console.error('Erro ao buscar endereço:', error);
        message.innerHTML = 'Clique no botão para marcar este local.';
      }

      const button = L.DomUtil.create('button', 'popup-button', container);
      button.textContent = 'Marcar local';

      L.DomEvent.on(button, 'click', (buttonEvent) => {
        L.DomEvent.stopPropagation(buttonEvent);
        markerRef.current.bindPopup('<strong>Local marcado</strong>').openPopup();
        setSelectedLocation(latlng);
        lastPopupRef.current = popup;
        fetchAddress(latlng.lat, latlng.lng);
        setShowForm(true);
      });

      popup.setLatLng(latlng).setContent(container).openOn(map);
    });

    return () => {
      map.remove();
    };
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!selectedLocation) return;

    console.log('Enviar local', {
      location: selectedLocation,
      photo,
      date,
      notes,
    });

    setSelectedLocation(null);
    setSelectedAddress('');
    setShowForm(false);
    setPhoto(null);
    setDate('');
    setNotes('');
    alert('Dados enviados com sucesso!');
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedLocation(null);
    setSelectedAddress('');
    setPhoto(null);
    setDate('');
    setNotes('');
    
    // Forçar o Leaflet a recalcular o tamanho do mapa quando voltar
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
        <div className="upload-screen">
          <div className="upload-card">
            <button
              className="close-button"
              onClick={handleCloseForm}
              type="button"
            >
              ✕
            </button>
            <h1>Enviar foto do local</h1>
            {selectedLocation && selectedAddress && (
              <p className="upload-location">
                Endereço: {selectedAddress}
              </p>
            )}
            <form className="upload-form" onSubmit={handleSubmit}>
              <label className="upload-field">
                Foto do local
                <input type="file" accept="image/*" onChange={handlePhotoChange} />
              </label>

              <label className="upload-field">
                Desde
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>

              <label className="upload-field">
                Informações adicionais
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Escreva detalhes do local..."
                />
              </label>

              <button type="submit" className="submit-button">
                Enviar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MapScreen;
