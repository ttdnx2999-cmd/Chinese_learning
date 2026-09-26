import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function HomePage() {
  const { user } = useAuth();
  return <div className="home-page">
    <header className="page-heading"><div><p className="eyebrow">YOUR LEARNING SPACE</p><h1>Make familiar words<br className="desktop-break" /> feel like second nature.</h1><p>Welcome back, {user?.username}. A little practice goes a long way.</p></div><span className="quiet-badge">At your own pace</span></header>
    <section className="practice-hero" aria-labelledby="hero-title"><div className="hero-copy"><span className="hero-label">WORDS YOU KNOW. NEW POSSIBILITIES.</span><h2 id="hero-title">Your vocabulary.<br />Real sentences.</h2><p>Connect the words you’ve learned through sentence practice built around your chapters.</p><Link className="button primary" to="/phrases">Practice sentences <span aria-hidden="true">↗</span></Link><Link className="hero-secondary" to="/vietnamese-phrases">Practice with Vietnamese →</Link></div><div className="hero-art" aria-hidden="true"><span className="art-caption">A SMALL STEP, EVERY DAY</span><div className="word-tile tile-one"><span lang="zh">学</span><small>xué · learn</small></div><div className="word-tile tile-two"><span lang="zh">习</span><small>xí · practice</small></div><span className="art-circle" /></div></section>
    <div className="section-heading"><div><p className="eyebrow">KEEP IT FAMILIAR</p><h2>Choose your practice</h2></div><span>Small sessions. Steady confidence.</span></div>
    <section className="practice-grid" aria-label="Practice options">
      <Link className="practice-option" to="/chapter-flashcards"><span className="option-icon sage" aria-hidden="true">▤</span><h3>Chapter flashcards</h3><p>Choose the chapters you’ve studied. Recall each word, then reveal its meaning.</p><span className="card-link">Choose chapters <span aria-hidden="true">→</span></span></Link>
      <Link className="practice-option" to="/flashcards"><span className="option-icon amber" aria-hidden="true">☆</span><h3>Your favorites</h3><p>Give the words you’ve saved a little more attention with a focused review.</p><span className="card-link">Review favorites <span aria-hidden="true">→</span></span></Link>
      <Link className="practice-option" to="/vocabulary"><span className="option-icon lilac" aria-hidden="true">字</span><h3>Your word collection</h3><p>Explore your vocabulary, check meanings, and keep your learning organized.</p><span className="card-link">Open vocabulary <span aria-hidden="true">→</span></span></Link>
    </section>
    <section className="getting-started"><div><span className="eyebrow">BUILD YOUR FOUNDATION</span><h2>Your practice starts with your words.</h2><p>{user?.role === 'child' ? 'Your linked parent account provides your vocabulary. Choose a chapter and start practicing.' : 'Add the vocabulary you’re learning, organize it into chapters, and practice at a level that feels right.'}</p></div><Link className="button secondary" to={user?.role === 'child' ? '/chapter-flashcards' : '/vocabulary-upload'}>{user?.role === 'child' ? 'Choose chapters' : 'Add vocabulary'} <span aria-hidden="true">+</span></Link></section>
  </div>;
}
