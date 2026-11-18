import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { S } from './store.js';
import App from './App.jsx';
import './styles/app.css';
import './styles/web-mockup.css';
import './styles/loading.css';
import './styles/step1.css';
import './styles/step2.css';

// ?easy=1 → 처음 화면을 건너뛰고 쉬운 화면으로 시작 · 그 밖에는 처음 화면부터
if (new URLSearchParams(location.search).get('easy') === '1') S.easy = true;
S.home = !S.easy;

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
