import React from 'react';
import { useApp } from './context';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MenuPanel from '../components/MenuPanel';
import GamePage from '../pages/game/GamePage';
import AboutPage from '../pages/about/AboutPage';
import HelpPanel from '../panels/help/HelpPanel';
import StatsPanel from '../panels/stats/StatsPanel';

export default function App() {
  const { page, content, announcement } = useApp();
  return (
    <>
      <a className="skip-link" href="#main">{content.skipLink[page]}</a>
      <Header />
      {page === 'about' ? <AboutPage /> : <GamePage />}
      <Footer />
      <HelpPanel />
      <StatsPanel />
      <MenuPanel />
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
    </>
  );
}
