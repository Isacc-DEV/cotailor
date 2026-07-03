'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/ui';
import './error.css';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="error-page">
      <div className="error-container">
        <div className="error-code">404</div>
        <h1>Page Not Found</h1>
        <p>Sorry, the page you're looking for doesn't exist.</p>

        <div className="error-actions">
          <Button variant="primary" size="lg" onClick={() => router.push('/')}>
            Go Home
          </Button>
          <Button variant="secondary" size="lg" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>

        <div className="error-suggestions">
          <h3>Here's what you can do:</h3>
          <ul>
            <li>
              <button onClick={() => router.push('/')}>Return to home page</button>
            </li>
            <li>
              <button onClick={() => router.push('/profile-selector')}>Start a new session</button>
            </li>
            <li>
              <button onClick={() => router.push('/session-history')}>View your sessions</button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
