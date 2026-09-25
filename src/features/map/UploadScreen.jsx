import React, { useEffect } from 'react';
import './map.css';

function UploadScreen({
  onClose,
  onSubmit,
  onPhotoChange,
  date,
  setDate,
  notes,
  setNotes,
  selectedLocation,
  selectedAddress,
}) {
  useEffect(() => {
    const scrollY = window.scrollY || window.pageYOffset;
    const docEl = document.documentElement;
    const body = document.body;
    docEl.classList.add('no-scroll');
    body.classList.add('no-scroll');
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';

    return () => {
      docEl.classList.remove('no-scroll');
      body.classList.remove('no-scroll');
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  return (
    <div className="upload-screen">
      <div className="upload-card">
        <button
          className="close-button"
          onClick={onClose}
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
        <form className="upload-form" onSubmit={onSubmit}>
          <label className="upload-field">
            Foto do local
            <input type="file" accept="image/*" onChange={onPhotoChange} />
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
  );
}

export default UploadScreen;
