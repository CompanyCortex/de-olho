import L from 'leaflet';

export const API_BASE_URL = 'http://localhost:8080';

const streetNameCache = new Map();

export async function fetchStreetNameFromCoordinates(latitude, longitude) {
  const key = `${Number(latitude).toFixed(6)}:${Number(longitude).toFixed(6)}`;
  const cached = streetNameCache.get(key);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
      {
        headers: {
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        },
      }
    );

    if (!response.ok) {
      const fallback = 'Local';
      streetNameCache.set(key, fallback);
      return fallback;
    }

    const data = await response.json();
    const address = data && data.address ? data.address : {};
    const streetName = address.road || address.street || address.neighbourhood || 'Local';
    streetNameCache.set(key, streetName);
    return streetName;
  } catch (error) {
    const fallback = 'Local';
    streetNameCache.set(key, fallback);
    return fallback;
  }
}

function normalizePin(pin) {
  if (!pin || typeof pin !== 'object') {
    return null;
  }

  const latitude = Number(pin.latitude);
  const longitude = Number(pin.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    id: Number(pin.id),
    latitude,
    longitude,
    info: pin.info || 'Sem informação',
    address: pin.address || pin.fullAddress || '',
    fullAddress: pin.fullAddress || pin.address || '',
    imageDate: pin.imageDate || pin.date || '',
  };
}

async function requestPins(minLat, maxLat, minLng, maxLng) {
  const params = new URLSearchParams({
    minLat: String(minLat),
    maxLat: String(maxLat),
    minLng: String(minLng),
    maxLng: String(maxLng),
  });

  const response = await fetch(`${API_BASE_URL}/api/pins?${params.toString()}`);
  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map(normalizePin)
    .filter((pin) => pin !== null && Number.isFinite(pin.id));
}

export async function fetchPins(minLat, maxLat, minLng, maxLng) {
  const south = Number(minLat);
  const north = Number(maxLat);
  const west = Number(minLng);
  const east = Number(maxLng);

  if ([south, north, west, east].some((value) => !Number.isFinite(value))) {
    return [];
  }

  const normalizedMinLat = Math.min(south, north);
  const normalizedMaxLat = Math.max(south, north);

  const requests = [];

  if (west <= east) {
    requests.push(requestPins(normalizedMinLat, normalizedMaxLat, west, east));
  } else {
    requests.push(
      requestPins(normalizedMinLat, normalizedMaxLat, west, 180),
      requestPins(normalizedMinLat, normalizedMaxLat, -180, east)
    );
  }

  const results = await Promise.all(
    requests.map((promise) => Promise.resolve(promise).catch(() => []))
  );

  const mergedPins = new Map();
  results.flat().forEach((pin) => {
    if (pin && pin.id != null) {
      mergedPins.set(pin.id, pin);
    }
  });

  return Array.from(mergedPins.values());
}

export async function uploadForm(fileOrPayload, dateOrInfo, infoOrLatitude, latitudeOrLongitude, maybeLongitude) {
  let file;
  let date;
  let info;
  let latitude;
  let longitude;

  if (fileOrPayload && typeof fileOrPayload === 'object' && !('name' in fileOrPayload) && !('type' in fileOrPayload)) {
    ({ file, date, info, latitude, longitude } = fileOrPayload);
  } else {
    file = fileOrPayload;
    date = dateOrInfo;
    info = infoOrLatitude;
    latitude = latitudeOrLongitude;
    longitude = maybeLongitude;
  }

  if (!file) {
    throw new Error('Selecione uma imagem antes de enviar.');
  }

  if (!date) {
    throw new Error('Informe a data da imagem.');
  }

  if (!info || !String(info).trim()) {
    throw new Error('Escreva uma descrição ou informação do local.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('date', date);
  formData.append('info', info);

  if (latitude !== undefined && latitude !== null && latitude !== '') {
    formData.append('latitude', String(latitude));
  }

  if (longitude !== undefined && longitude !== null && longitude !== '') {
    formData.append('longitude', String(longitude));
  }

  const response = await fetch(`${API_BASE_URL}/api/form`, {
    method: 'POST',
    body: formData,
  });

  if (response.status !== 201) {
    const message = await response.text().catch(() => '');
    throw new Error(message || 'Não foi possível enviar o registro.');
  }

  const rawText = await response.text();
  const trimmed = rawText.trim();
  if (!trimmed) {
    return 0;
  }

  const numericId = Number(trimmed);
  return Number.isFinite(numericId) ? numericId : 0;
}

export function renderPinsOnMap(map, pins, options = {}) {
  if (!map || !Array.isArray(pins)) {
    return null;
  }

  const { onPinClick } = options;

  if (map._deOlhoPinsLayer) {
    map.removeLayer(map._deOlhoPinsLayer);
  }

  const redPinIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  const layer = L.layerGroup();
  pins.forEach((pin) => {
    if (!pin || !Number.isFinite(pin.latitude) || !Number.isFinite(pin.longitude)) {
      return;
    }

    const marker = typeof L.marker === 'function' ? L.marker([pin.latitude, pin.longitude], { icon: redPinIcon }) : null;
    if (!marker) {
      return;
    }

    const popupContent = document.createElement('div');
    popupContent.className = 'pin-popup';

    const title = document.createElement('div');
    title.className = 'pin-popup-title';
    title.textContent = pin.fullAddress || pin.address || 'Local';

    const subtitle = document.createElement('div');
    subtitle.className = 'pin-popup-date';
    subtitle.textContent = pin.info || 'Sem informação';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pin-popup-button';
    button.textContent = 'Ver detalhes';

    popupContent.appendChild(title);
    popupContent.appendChild(subtitle);
    popupContent.appendChild(button);

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (typeof onPinClick === 'function') {
        onPinClick(pin);
      }
    });

    marker.bindPopup(popupContent);
    marker.addTo(layer);
  });

  map.addLayer(layer);
  map._deOlhoPinsLayer = layer;
  return layer;
}
