import { Component, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
              <h1 className="text-2xl font-bold text-gray-900">配置錯誤 / Configuration Error</h1>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="font-semibold text-red-800 mb-2">錯誤信息 / Error Message:</p>
              <p className="text-red-700 font-mono text-sm">{this.state.error?.message}</p>
            </div>

            <div className="space-y-4 text-gray-700">
              <p className="font-semibold">請檢查以下配置 / Please check the following configuration:</p>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>確保在 Render 儀表板中設置了環境變量 / Ensure environment variables are set in Render dashboard</li>
                <li>需要的變量 / Required variables:
                  <ul className="list-disc list-inside ml-6 mt-1 text-sm">
                    <li><code className="bg-gray-100 px-2 py-1 rounded">VITE_SUPABASE_URL</code></li>
                    <li><code className="bg-gray-100 px-2 py-1 rounded">VITE_SUPABASE_ANON_KEY</code></li>
                  </ul>
                </li>
                <li>設置環境變量後，需要重新部署應用 / After setting environment variables, redeploy the application</li>
              </ol>
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>提示 / Tip:</strong> 環境變量必須在構建時可用。請在 Render 的 Environment 標籤中添加這些變量，然後觸發新的部署。
                <br />
                Environment variables must be available at build time. Add these variables in Render's Environment tab, then trigger a new deployment.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
