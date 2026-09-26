import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const learningLinks = [
  ['/', '⌂', 'Overview'], ['/phrases', '文', 'Chinese sentences'],
  ['/vietnamese-phrases', '译', 'Vietnamese practice'],
  ['/flashcards', '☆', 'Favorite flashcards'], ['/chapter-flashcards', '▤', 'Chapter flashcards'],
  ['/vocabulary', '字', 'My vocabulary']
];

export default function Navigation() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key !== 'Tab') return;
      const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('a,button') || []).filter(el => el.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = oldOverflow; window.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [open]);
  if (!user) return null;
  const link = ([to, icon, label]: string[]) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}><span className="nav-icon" aria-hidden="true">{icon}</span>{label}</NavLink>;
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="mobile-header"><Link className="brand" to="/"><span className="brand-mark" lang="zh">习</span><span>Chinese Learning<small>One familiar word at a time</small></span></Link><span className="account-initial" title={user.username}>{user.username.slice(0, 1).toUpperCase()}</span></header>
    {open && <div className="nav-backdrop" onClick={() => setOpen(false)} />}
    <aside id="app-navigation" ref={panel} className={`sidebar${open ? ' is-open' : ''}`} role={open ? 'dialog' : undefined} aria-modal={open || undefined} aria-label="Navigation">
      <div className="sidebar-brand"><Link className="brand" to="/"><span className="brand-mark" lang="zh">习</span><span>Chinese Learning<small>Learn. Connect. Remember.</small></span></Link><button className="close-navigation" aria-label="Close navigation" onClick={() => setOpen(false)}>×</button></div>
      <nav aria-label="Learning"><p className="nav-label">YOUR PRACTICE</p>{learningLinks.map(link)}</nav>
      {user.role !== 'child' && <nav aria-label="Manage"><p className="nav-label">YOUR LIBRARY</p>{[['/vocabulary-upload', '+', 'Upload vocabulary'], ['/vocabulary-sharing', '↗', 'Share vocabulary'], ['/database-admin', '▣', 'Database tools'], ...(user.role === 'admin' ? [['/admin', '⚙', 'Admin panel']] : [])].map(link)}</nav>}
      <div className="sidebar-note"><span lang="zh">温故知新</span><p>Build something new<br />with words you know.</p></div>
      <div className="sidebar-account"><span className="account-initial">{user.username.slice(0, 1).toUpperCase()}</span><span className="account-name">{user.username}<small>{user.role === 'admin' ? 'Administrator' : user.role === 'parent' ? 'Parent account' : 'Learner'}</small></span><button className="sign-out" onClick={logout} aria-label="Sign out" title="Sign out">↪</button></div>
    </aside>
    <nav className="bottom-nav" aria-label="Quick navigation">
      {[['/', '⌂', 'Home'], ['/phrases', '文', 'Sentences'], ['/chapter-flashcards', '▤', 'Cards'], ['/vocabulary', '字', 'Words']].map(([to, icon, label]) => <NavLink to={to} end key={to} className={({ isActive }) => isActive || (to === '/chapter-flashcards' && pathname === '/flashcards') ? 'active' : ''}><span aria-hidden="true">{icon}</span>{label}</NavLink>)}
      <button ref={menuButton} aria-expanded={open} aria-controls="app-navigation" onClick={() => setOpen(true)}><span aria-hidden="true">☰</span>More</button>
    </nav>
  </>;
}
