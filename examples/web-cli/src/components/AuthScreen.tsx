import React, { useState } from 'react';
import { Key, Lock, Terminal, AlertCircle, ArrowRight, Save, RefreshCw } from 'lucide-react';

interface AuthScreenProps {
  onAuthenticate: (apiKey: string, remember?: boolean) => void;
  rememberCredentials: boolean;
  onRememberChange: (remember: boolean) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticate,
  rememberCredentials,
  onRememberChange
}) => {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check if there are saved credentials to clear (domain-scoped or old format)
  const hasSavedCredentials = (() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('ably.web-cli.signedConfig.') ||
          key?.startsWith('ably.web-cli.apiKey')) {
        return true;
      }
    }
    return false;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!apiKey.trim()) {
        setError('API Key is required to connect to Ably');
        return;
      }

      // Basic validation for API key format
      if (!apiKey.includes(':')) {
        setError('API Key should be in the format: app_name.key_name:key_secret');
        return;
      }

      await onAuthenticate(apiKey.trim(), rememberCredentials);
    } catch (error) {
      console.error('[AuthScreen] Authentication failed:', error);
      setError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClearSavedCredentials = () => {
    // Clear all domain-scoped signed config keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('ably.web-cli.signedConfig.') ||
          key?.startsWith('ably.web-cli.signature.') ||
          key?.startsWith('ably.web-cli.rememberCredentials.') ||
          key?.startsWith('ably.web-cli.apiKey') ||
          key?.startsWith('ably.web-cli.accessToken')) {
        keysToRemove.push(key);
      }
    }

    // Remove all identified keys
    keysToRemove.forEach(key => localStorage.removeItem(key));

    setError('');
    // Force a refresh to show the change
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Terminal className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Ably Web CLI Terminal</h1>
          <p className="text-gray-400">Enter your credentials to start a terminal session</p>
        </div>

        <div className="bg-gray-900 rounded-lg shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="apiKey" className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
                <Key size={16} />
                <span>API Key *</span>
              </label>
              <input
                id="apiKey"
                type="text"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setError(''); // Clear error when user types
                }}
                placeholder="your_app.key_name:key_secret"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                autoFocus
              />
              <p className="mt-2 text-xs text-gray-500">
                You can find your API key in the Ably dashboard under your app settings
              </p>
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 flex items-start space-x-3">
                <AlertCircle className="text-red-400 mt-0.5" size={20} />
                <span className="text-sm text-red-300">{error}</span>
              </div>
            )}

            <div className="flex items-center space-x-3">
              <input
                id="rememberCredentials"
                type="checkbox"
                checked={rememberCredentials}
                onChange={(e) => onRememberChange(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-700 rounded focus:ring-blue-500"
              />
              <label htmlFor="rememberCredentials" className="flex items-center space-x-2 text-sm text-gray-300 cursor-pointer">
                <Save size={16} />
                <span>Remember credentials for future sessions</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{isLoading ? 'Signing credentials...' : 'Connect to Terminal'}</span>
              <ArrowRight size={20} />
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-800 space-y-3">
            <p className="text-xs text-gray-500 text-center">
              Don't have an Ably account?{' '}
              <a 
                href="https://ably.com/sign-up" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Sign up for free
              </a>
            </p>
            {hasSavedCredentials && (
              <p className="text-xs text-center">
                <button
                  type="button"
                  onClick={handleClearSavedCredentials}
                  className="text-red-400 hover:text-red-300 underline inline-flex items-center space-x-1"
                >
                  <RefreshCw size={12} />
                  <span>Clear saved credentials</span>
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};