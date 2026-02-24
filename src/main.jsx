// src/main.jsx
import './index.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import ZolvApp from './ZolvApp.jsx';
import Admin from './admin/Admin.jsx';
import Login from './admin/Login.jsx';

// Páginas legales
import AvisoPrivacidad from './legal/AvisoPrivacidad.jsx';
import PoliticaCookies from './legal/PoliticaCookies.jsx';
import TerminosCondiciones from './legal/TerminosCondiciones.jsx';

// Banner de cookies
import CookieConsent from './components/CookieConsent.jsx';

const router = createBrowserRouter([
  { path: '/', element: <ZolvApp /> },
  { path: '/admin/login', element: <Login /> },
  { path: '/admin', element: <Admin /> },
  { path: '/aviso-privacidad', element: <AvisoPrivacidad /> },
  { path: '/cookies', element: <PoliticaCookies /> },
  { path: '/terminos', element: <TerminosCondiciones /> },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <>
      <RouterProvider router={router} />
      <CookieConsent />
    </>
  </React.StrictMode>
);
