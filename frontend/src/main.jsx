import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

console.log('✅ VERSION: LOADED_NEW_BUILD_JAN_30_FIXED_LOGO'); // Deployment Check

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
