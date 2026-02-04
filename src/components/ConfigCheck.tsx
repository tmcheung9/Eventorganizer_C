import { AlertCircle } from 'lucide-react';

export function ConfigCheck() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

  if (isConfigured) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-8 h-8 text-yellow-600" />
          <h1 className="text-2xl font-bold text-gray-900">缺少配置 / Missing Configuration</h1>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="font-semibold text-yellow-800 mb-2">Environment variables are not configured</p>
          <div className="text-sm text-yellow-700 space-y-1">
            <p>VITE_SUPABASE_URL: {supabaseUrl ? '✓ Set' : '✗ Missing'}</p>
            <p>VITE_SUPABASE_ANON_KEY: {supabaseAnonKey ? '✓ Set' : '✗ Missing'}</p>
          </div>
        </div>

        <div className="space-y-4 text-gray-700">
          <p className="font-semibold">To fix this issue:</p>
          <ol className="list-decimal list-inside space-y-3 ml-4">
            <li>
              <strong>Go to your Render dashboard</strong>
              <p className="text-sm text-gray-600 ml-6 mt-1">Navigate to your service settings</p>
            </li>
            <li>
              <strong>Click on the "Environment" tab</strong>
              <p className="text-sm text-gray-600 ml-6 mt-1">This is where you add environment variables</p>
            </li>
            <li>
              <strong>Add these environment variables:</strong>
              <div className="ml-6 mt-2 space-y-2">
                <div className="bg-gray-50 p-3 rounded border">
                  <p className="text-sm font-mono">Key: <span className="text-blue-600">VITE_SUPABASE_URL</span></p>
                  <p className="text-sm font-mono">Value: Your Supabase project URL</p>
                </div>
                <div className="bg-gray-50 p-3 rounded border">
                  <p className="text-sm font-mono">Key: <span className="text-blue-600">VITE_SUPABASE_ANON_KEY</span></p>
                  <p className="text-sm font-mono">Value: Your Supabase anon key</p>
                </div>
              </div>
            </li>
            <li>
              <strong>Click "Save Changes"</strong>
              <p className="text-sm text-gray-600 ml-6 mt-1">Render will automatically redeploy your application</p>
            </li>
          </ol>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Important:</strong> Vite replaces these variables at build time. Make sure the environment variables are set BEFORE triggering a deployment. If you just added them, trigger a manual redeploy.
          </p>
        </div>
      </div>
    </div>
  );
}
