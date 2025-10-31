import React from 'react';
import ReactDOM from 'react-dom/client';
// Attempting a different import path. It's possible the file is named 'App.jsx' (uppercase A)
import App from './app.jsx'; 

// Find the 'root' div in your index.html and render your App component inside it
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

