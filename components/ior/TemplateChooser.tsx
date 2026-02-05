/**
 * TEMPLATE CHOOSER
 *
 * Modal for selecting and configuring message templates.
 * - Groups templates by category
 * - Shows preview with variable placeholders
 * - Collects variable inputs before sending
 */

'use client';

import { useState, useMemo } from 'react';
import { X, FileText, Clock, ChevronRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  variables: string[];
  slaDays?: number;
}

interface TemplateChooserProps {
  templates: MessageTemplate[];
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: MessageTemplate, variables: Record<string, string>) => void;
  producerName?: string;
}

// Category labels in Swedish
const categoryLabels: Record<string, string> = {
  pricing: 'Prissättning',
  logistics: 'Logistik',
  quality: 'Kvalitet',
  documents: 'Dokument',
  general: 'Allmänt',
};

// Variable labels in Swedish
const variableLabels: Record<string, string> = {
  producer_name: 'Producentnamn',
  product_name: 'Produktnamn',
  vintage: 'Årgång',
  market: 'Marknad',
  order_number: 'Ordernummer',
  delivery_date: 'Leveransdatum',
  issue_description: 'Problembeskrivning',
  document_type: 'Dokumenttyp',
  allocation_year: 'Allokeringsår',
  importer_name: 'Importörnamn',
};

function TemplateCard({
  template,
  onClick,
}: {
  template: MessageTemplate;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-4 rounded-lg border border-gray-200 bg-white',
        'hover:border-wine/30 hover:shadow-sm transition-all',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate">{template.name}</h4>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
            {template.subject}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
      </div>

      <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
        {template.slaDays && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {template.slaDays} dagars SLA
          </span>
        )}
        {template.variables.length > 0 && (
          <span>
            {template.variables.length} fält att fylla i
          </span>
        )}
      </div>
    </button>
  );
}

function TemplatePreview({
  template,
  variables,
  onVariableChange,
  onBack,
  onConfirm,
  producerName,
}: {
  template: MessageTemplate;
  variables: Record<string, string>;
  onVariableChange: (key: string, value: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  producerName?: string;
}) {
  // Replace variables in text with actual values or placeholders
  const renderPreview = (text: string) => {
    let result = text;
    template.variables.forEach((v) => {
      const value = variables[v] || `[${variableLabels[v] || v}]`;
      result = result.replace(new RegExp(`{{${v}}}`, 'g'), value);
    });
    // Also replace producer_name if provided
    if (producerName) {
      result = result.replace(/{{producer_name}}/g, producerName);
    }
    return result;
  };

  const allVariablesFilled = template.variables
    .filter((v) => v !== 'producer_name') // producer_name is auto-filled
    .every((v) => variables[v]?.trim());

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{template.name}</h3>
          <p className="text-sm text-gray-500">
            {categoryLabels[template.category] || template.category}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Variables form */}
        {template.variables.filter((v) => v !== 'producer_name').length > 0 && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-700">
              Fyll i uppgifter
            </h4>
            {template.variables
              .filter((v) => v !== 'producer_name')
              .map((variable) => (
                <div key={variable}>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    {variableLabels[variable] || variable}
                  </label>
                  <input
                    type="text"
                    value={variables[variable] || ''}
                    onChange={(e) => onVariableChange(variable, e.target.value)}
                    placeholder={`Ange ${(variableLabels[variable] || variable).toLowerCase()}`}
                    className={cn(
                      'w-full px-3 py-2 border border-gray-300 rounded-lg',
                      'focus:outline-none focus:ring-2 focus:ring-wine focus:border-transparent',
                      'placeholder:text-gray-400'
                    )}
                  />
                </div>
              ))}
          </div>
        )}

        {/* Preview */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Förhandsvisning</h4>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="text-sm">
              <span className="text-gray-500">Ämne: </span>
              <span className="font-medium text-gray-900">
                {renderPreview(template.subject)}
              </span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {renderPreview(template.body)}
              </p>
            </div>
          </div>

          {template.slaDays && (
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Förfallodatum sätts till {template.slaDays} dagar från idag
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t bg-gray-50 flex gap-3">
        <button
          onClick={onBack}
          className={cn(
            'flex-1 px-4 py-2.5 rounded-lg border border-gray-300',
            'text-gray-700 font-medium hover:bg-gray-100 transition-colors'
          )}
        >
          Tillbaka
        </button>
        <button
          onClick={onConfirm}
          disabled={!allVariablesFilled}
          className={cn(
            'flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors',
            allVariablesFilled
              ? 'bg-wine text-white hover:bg-wine/90'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          )}
        >
          Använd mall
        </button>
      </div>
    </div>
  );
}

export function TemplateChooser({
  templates,
  isOpen,
  onClose,
  onSelect,
  producerName,
}: TemplateChooserProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});

  // Group templates by category
  const groupedTemplates = useMemo(() => {
    const groups: Record<string, MessageTemplate[]> = {};
    templates.forEach((template) => {
      const category = template.category || 'general';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(template);
    });
    return groups;
  }, [templates]);

  const handleSelectTemplate = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    // Pre-fill producer_name if available
    if (producerName) {
      setVariables({ producer_name: producerName });
    } else {
      setVariables({});
    }
  };

  const handleVariableChange = (key: string, value: string) => {
    setVariables((prev) => ({ ...prev, [key]: value }));
  };

  const handleConfirm = () => {
    if (selectedTemplate) {
      onSelect(selectedTemplate, variables);
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedTemplate(null);
    setVariables({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col',
          'animate-in fade-in-0 zoom-in-95 duration-200'
        )}
      >
        {selectedTemplate ? (
          <TemplatePreview
            template={selectedTemplate}
            variables={variables}
            onVariableChange={handleVariableChange}
            onBack={() => setSelectedTemplate(null)}
            onConfirm={handleConfirm}
            producerName={producerName}
          />
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-wine/10 rounded-lg">
                  <FileText className="h-5 w-5 text-wine" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Välj mall</h2>
                  <p className="text-sm text-gray-500">
                    {templates.length} mallar tillgängliga
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Template list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
                <div key={category}>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    {categoryLabels[category] || category}
                  </h3>
                  <div className="space-y-2">
                    {categoryTemplates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onClick={() => handleSelectTemplate(template)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={handleClose}
                className={cn(
                  'w-full px-4 py-2.5 rounded-lg border border-gray-300',
                  'text-gray-700 font-medium hover:bg-gray-100 transition-colors'
                )}
              >
                Avbryt
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
