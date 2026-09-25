jest.mock('leaflet', () => {
  const markerInstances = [];

  const createMarker = () => {
    const marker = {
      bindPopup: jest.fn(function () { return this; }),
      addTo: jest.fn(function () { return this; }),
      getPopup: jest.fn(() => ({ setContent: jest.fn() })),
    };
    markerInstances.push(marker);
    return marker;
  };

  return {
    __esModule: true,
    default: {
      icon: jest.fn(() => 'icon'),
      marker: jest.fn(() => createMarker()),
      layerGroup: jest.fn(() => ({ addLayer: jest.fn(), removeLayer: jest.fn() })),
    },
  };
});

import { fetchPins, renderPinsOnMap, uploadForm } from './features/map/api';

describe('fetchPins', () => {
  test('faz duas chamadas quando o bounding box cruza o antimeridiano', async () => {
    const mockJson = jest.fn();
    global.fetch = jest.fn((url) => {
      const response = {
        ok: true,
        json: async () => {
          if (url.includes('minLng=170&maxLng=180')) {
            return [{ id: 1, latitude: -10, longitude: 175, info: 'Leste', imageDate: '2026-09-01' }];
          }

          if (url.includes('minLng=-180&maxLng=-170')) {
            return [{ id: 2, latitude: -9, longitude: -175, info: 'Oeste', imageDate: '2026-09-02' }];
          }

          return [];
        },
      };

      mockJson.mockResolvedValue(response.json());
      return Promise.resolve(response);
    });

    const pins = await fetchPins(-12, 12, 170, -170);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(pins).toHaveLength(2);
    expect(pins.map(pin => pin.id)).toEqual(expect.arrayContaining([1, 2]));
  });
});

describe('renderPinsOnMap', () => {
  test('não chama reverse geocoding ao montar os pins', async () => {
    global.fetch = jest.fn();

    const map = {
      _deOlhoPinsLayer: null,
      removeLayer: jest.fn(),
      addLayer: jest.fn(),
    };

    renderPinsOnMap(map, [
      { id: 1, latitude: -23.6, longitude: -46.6, info: 'Comentário 1' },
      { id: 2, latitude: -23.7, longitude: -46.7, info: 'Comentário 2' },
    ]);

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('uploadForm', () => {
  test('envia FormData com os campos esperados', async () => {
    const formData = new FormData();
    formData.append('file', new File(['photo'], 'photo.png', { type: 'image/png' }));
    formData.append('date', '2026-09-14');
    formData.append('info', 'Descrição');
    formData.append('latitude', '10');
    formData.append('longitude', '20');

    global.fetch = jest.fn(async () => ({
      status: 201,
      text: async () => '42',
    }));

    const response = await uploadForm(
      formData.get('file'),
      '2026-09-14',
      'Descrição',
      10,
      20
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(response).toBe(42);
  });
});
