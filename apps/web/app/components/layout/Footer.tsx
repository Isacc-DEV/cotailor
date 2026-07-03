'use client';

import { useRouter } from 'next/navigation';
import './footer.css';

export function Footer() {
  const router = useRouter();

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          {/* Brand Column */}
          <div className="footer-column">
            <div className="footer-logo">
              <div className="logo-icon">✓</div>
              <span>CoTailor</span>
            </div>
            <p className="footer-tagline">Check job fit before you write a word — and never put anything on your resume that isn't true.</p>
          </div>

          {/* Product Links */}
          <div className="footer-column">
            <h4 className="footer-heading">Product</h4>
            <ul className="footer-links">
              <li>
                <button onClick={() => router.push('/')}>Home</button>
              </li>
              <li>
                <button onClick={() => router.push('/profile-selector')}>Get Started</button>
              </li>
              <li>
                <button onClick={() => router.push('/session-history')}>My Sessions</button>
              </li>
            </ul>
          </div>

          {/* Resources Links */}
          <div className="footer-column">
            <h4 className="footer-heading">Resources</h4>
            <ul className="footer-links">
              <li>
                <a href="#" target="_blank" rel="noopener noreferrer">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#" target="_blank" rel="noopener noreferrer">
                  Resume Tips
                </a>
              </li>
              <li>
                <a href="#" target="_blank" rel="noopener noreferrer">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div className="footer-column">
            <h4 className="footer-heading">Legal</h4>
            <ul className="footer-links">
              <li>
                <a href="#" target="_blank" rel="noopener noreferrer">
                  Privacy
                </a>
              </li>
              <li>
                <a href="#" target="_blank" rel="noopener noreferrer">
                  Terms
                </a>
              </li>
              <li>
                <a href="#" target="_blank" rel="noopener noreferrer">
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <p>© 2026 CoTailor. All rights reserved.</p>
          <div className="footer-social">
            <a href="#" title="GitHub" rel="noopener noreferrer">
              GitHub
            </a>
            <a href="#" title="Twitter" rel="noopener noreferrer">
              Twitter
            </a>
            <a href="#" title="LinkedIn" rel="noopener noreferrer">
              LinkedIn
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
