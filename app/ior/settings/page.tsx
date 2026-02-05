/**
 * IOR SETTINGS PAGE
 * Placeholder for v1
 */

import { Settings } from 'lucide-react';

export default function IORSettingsPage() {
  return (
    <div className="py-6 px-4 lg:px-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Inställningar</h1>
        <p className="text-gray-500 mb-8">Hantera dina importörinställningar</p>

        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-12 text-center">
          <Settings className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Inställningar kommer snart</p>
          <p className="text-sm text-gray-400 mt-2">
            Här kommer du kunna hantera företagsprofil, notifieringar och integrationer
          </p>
        </div>
      </div>
    </div>
  );
}
