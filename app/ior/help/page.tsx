/**
 * IOR HELP PAGE
 * Placeholder for v1
 */

import { HelpCircle, Mail } from 'lucide-react';

export default function IORHelpPage() {
  return (
    <div className="py-6 px-4 lg:px-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Hjälp</h1>
        <p className="text-gray-500 mb-8">Få support och hitta svar på vanliga frågor</p>

        <div className="bg-white border rounded-lg p-6 mb-6">
          <h2 className="font-medium text-gray-900 mb-4">Kontakta support</h2>
          <p className="text-gray-600 mb-4">
            Har du frågor eller behöver hjälp? Kontakta oss så återkommer vi så snart vi kan.
          </p>
          <a
            href="mailto:support@winefeed.se"
            className="inline-flex items-center gap-2 px-4 py-2 bg-wine text-white rounded-lg hover:bg-wine/90 transition-colors"
          >
            <Mail className="h-4 w-4" />
            support@winefeed.se
          </a>
        </div>

        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center">
          <HelpCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">FAQ kommer snart</p>
        </div>
      </div>
    </div>
  );
}
