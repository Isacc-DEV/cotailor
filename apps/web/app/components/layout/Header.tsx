'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui';
import './header.css';

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse user', e);
      }
    }
  }, []);

  const isHomePage = pathname === '/';
  const isProfileRelated =
    pathname === '/profile-selector' ||
    pathname === '/create-profile' ||
    pathname === '/profile-editor';
  const isSessionActive =
    pathname?.includes('/jd-input') ||
    pathname?.includes('/decision-board') ||
    pathname?.includes('/strategy-review') ||
    pathname?.includes('/resume-preview');

  const handleNavigation = (path) => {
    router.push(path);
    setMobileMenuOpen(false);
  };

  const handleSignOut = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/');
  };

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-logo" onClick={() => handleNavigation('/')}>
          <div className="logo-icon">?</div>
          <span className="logo-text">CoTailor</span>
        </div>

        <nav className="header-nav-desktop">
          <button
            className={`nav-link ${isHomePage ? 'active' : ''}`}
            onClick={() => handleNavigation('/')}
          >
            Home
          </button>
          <button
            className={`nav-link ${isSessionActive ? 'active' : ''}`}
            onClick={() => handleNavigation('/profile-selector')}
          >
            Tailor Resume
          </button>
          <button
            className={`nav-link ${isProfileRelated && !isSessionActive ? 'active' : ''}`}
            onClick={() => handleNavigation('/session-history')}
          >
            History
          </button>
        </nav>

        <div className="header-actions-desktop">
          {isClient && user ? (
            <>
              <span className="user-name">{user.name}</span>
              <Button variant="secondary" size="sm" onClick={() => handleNavigation('/settings')}>
                ⚙️ Settings
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleNavigation('/profile-selector')}>
                New Session
              </Button>
              <Button variant="tertiary" size="sm" onClick={handleSignOut}>
                Sign Out
              </Button>
            </>
          ) : isClient ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => handleNavigation('/auth/signin')}>
                Sign In
              </Button>
              <Button variant="primary" size="sm" onClick={() => handleNavigation('/auth/signup')}>
                Sign Up
              </Button>
            </>
          ) : null}
        </div>

        <button
          className={`mobile-menu-btn ${mobileMenuOpen ? 'open' : ''}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span className="menu-line" />
          <span className="menu-line" />
          <span className="menu-line" />
        </button>
      </div>

      {mobileMenuOpen && (
        <nav className="header-nav-mobile">
          <button
            className={`mobile-nav-link ${isHomePage ? 'active' : ''}`}
            onClick={() => handleNavigation('/')}
          >
            Home
          </button>
          <button
            className={`mobile-nav-link ${isSessionActive ? 'active' : ''}`}
            onClick={() => handleNavigation('/profile-selector')}
          >
            Tailor Resume
          </button>
          <button
            className={`mobile-nav-link ${isProfileRelated && !isSessionActive ? 'active' : ''}`}
            onClick={() => handleNavigation('/session-history')}
          >
            Session History
          </button>
          {isClient && user ? (
            <>
              <div className="mobile-user-info">{user.name}</div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleNavigation('/settings')}
                className="mobile-action-btn"
              >
                ⚙️ Settings
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleNavigation('/profile-selector')}
                className="mobile-action-btn"
              >
                New Session
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSignOut}
                className="mobile-action-btn"
              >
                Sign Out
              </Button>
            </>
          ) : isClient ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleNavigation('/auth/signin')}
                className="mobile-action-btn"
              >
                Sign In
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleNavigation('/auth/signup')}
                className="mobile-action-btn"
              >
                Sign Up
              </Button>
            </>
          ) : null}
        </nav>
      )}
    </header>
  );
}
