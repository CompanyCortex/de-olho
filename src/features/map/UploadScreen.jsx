import React, { useEffect, useState } from 'react';
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
  const MAX_NOTES_LENGTH = 350;
  const [selectedFileName, setSelectedFileName] = useState('');

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

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    setSelectedFileName(file ? file.name : '');
    onPhotoChange(event);
  };

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

        <div className="upload-header">
          <span className="upload-badge">Nova ocorrência</span>
          <h1>Enviar foto do local</h1>
        </div>

        {selectedLocation && selectedAddress && (
          <p className="upload-location">
            Endereço: {selectedAddress}
          </p>
        )}

        <form className="upload-form" onSubmit={onSubmit}>
          <label className="upload-field">
            Foto do local
            <div className="upload-file-picker">
              <label htmlFor="photo-upload" className="upload-file-button">
                Escolher arquivo
              </label>
              {selectedFileName && <span className="upload-file-name">{selectedFileName}</span>}
              <input
                id="photo-upload"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
              />
            </div>
          </label>

          <label className="upload-field">
            Data da ocorrência
            <input
              type="date"
              value={date}
              max={new Date().toISOString().split('T')[0]}
              onChange={(event) => {
                const selectedDate = event.target.value;
                const today = new Date().toISOString().split('T')[0];

                if (!selectedDate || selectedDate <= today) {
                  setDate(selectedDate);
                }
              }}
            />
          </label>

          <label className="upload-field">
            <span className="upload-field-header">
              <span>Informações adicionais</span>
              <span className="upload-counter">{notes.length}/{MAX_NOTES_LENGTH}</span>
            </span>
            <textarea
              value={notes}
              maxLength={MAX_NOTES_LENGTH}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Descreva o que foi observado no local..."
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
