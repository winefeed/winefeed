/**
 * DIRECT DELIVERY LOCATION (DDL) - Document Generator
 *
 * Generate PDF application for Skatteverket form 5369_03
 * "Ansökan om direkt leveransplats"
 */

import { PDFDocument } from 'pdf-lib';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  DDLApplicationData,
  DDLDocumentGenerationError
} from './types';

// ============================================================================
// PDF Generator
// ============================================================================

export class DDLDocumentGenerator {
  /**
   * Generate PDF application (form 5369_03)
   *
   * Returns: { pdfBuffer: Buffer, fileHash: string }
   */
  async generateApplicationPDF(data: DDLApplicationData): Promise<{
    pdfBuffer: Buffer;
    fileHash: string;
  }> {
    try {
      // Load the official SKV 5369_03 form
      const formPath = path.join(process.cwd(), 'public', 'forms', 'skv_5369_03.pdf');
      const formBytes = fs.readFileSync(formPath);
      const pdfDoc = await PDFDocument.load(formBytes);

      // Get the form
      const form = pdfDoc.getForm();

      // ========================================================================
      // FILL IN FORM FIELDS
      // ========================================================================

      // SECTION 1: Säljare/Importör (Godkänd aktör som säljer/skickar varan)
      const sellerName = form.getTextField('Blankett5353Formular[0].Sida1[0].SubAllmannaUppgifterSäljare[0].Namn[0]');
      const importerAddressText = [
        data.importer.legal_name,
        data.importer.address_line1,
        data.importer.address_line2,
        `${data.importer.postal_code} ${data.importer.city}`
      ].filter(Boolean).join('\n');
      sellerName.setText(importerAddressText);
      sellerName.setFontSize(9); // Smaller font to fit multi-line address

      const sellerOrgNr = form.getTextField('Blankett5353Formular[0].Sida1[0].SubAllmannaUppgifterSäljare[0].PersOrgNr[0]');
      sellerOrgNr.setText(data.importer.org_number);

      const sellerPhone = form.getTextField('Blankett5353Formular[0].Sida1[0].SubAllmannaUppgifterSäljare[0].TelefonNr[0]');
      sellerPhone.setText(data.importer.contact_phone);

      const sellerContact = form.getTextField('Blankett5353Formular[0].Sida1[0].SubAllmannaUppgifterSäljare[0].Kontaktperson[0]');
      sellerContact.setText(data.importer.contact_name);

      const sellerContactPhone = form.getTextField('Blankett5353Formular[0].Sida1[0].SubAllmannaUppgifterSäljare[0].KontaktTelefonNr[0]');
      sellerContactPhone.setText(data.importer.contact_phone);

      const sellerEmail = form.getTextField('Blankett5353Formular[0].Sida1[0].SubAllmannaUppgifterSäljare[0].Epost[0]');
      sellerEmail.setText(data.importer.contact_email);

      // SECTION 2: Anmälan avser (check "Alkohol")
      const alcoholCheckbox = form.getCheckBox('Blankett5353Formular[0].Sida1[0].subAnmalanAvser[0].krsAlkohol[0]');
      alcoholCheckbox.check();

      // SECTION 3: Leveransplats (Följande plats/platser anmäls som direkt leveransplats)
      // Left column: Address information
      const deliveryAddressField = form.getTextField('Blankett5353Formular[0].Sida1[0].SubAllmannaUppgifterSäljare[1].Namn[0]');
      const addressText = [
        data.restaurant.legal_name,
        data.delivery_address.line1,
        data.delivery_address.line2,
        `${data.delivery_address.postal_code} ${data.delivery_address.city}`
      ].filter(Boolean).join('\n');
      deliveryAddressField.setText(addressText);
      deliveryAddressField.setFontSize(9); // Smaller font to fit multi-line address

      // Right column: Contact person and phone
      const contactField = form.getTextField('Blankett5353Formular[0].Sida1[0].SubAllmannaUppgifterSäljare[1].PersOrgNr[0]');
      const contactText = `${data.contact.name}\n${data.contact.phone}`;
      contactField.setText(contactText);
      contactField.setFontSize(9); // Smaller font for better fit

      // SECTION 4: Underskrift (Signature section)
      const signatureDate = form.getTextField('Blankett5353Formular[0].Sida1[0].SubUnderskrift[0].txtDatum[0]');
      const consentDate = new Date(data.consent_timestamp).toLocaleDateString('sv-SE');
      signatureDate.setText(consentDate);

      const signatureName = form.getTextField('Blankett5353Formular[0].Sida1[0].SubUnderskrift[0].txtNamnfortydligande[0]');
      signatureName.setText(data.contact.name);

      const signaturePhone = form.getTextField('Blankett5353Formular[0].Sida1[0].SubUnderskrift[0].txtTelefon[0]');
      signaturePhone.setText(data.contact.phone);

      // Update metadata
      pdfDoc.setTitle('Ansökan om direkt leveransplats - SKV 5369_03');
      pdfDoc.setSubject(`DDL Application - ${data.internal_reference}`);
      pdfDoc.setKeywords(['Skatteverket', 'Direkt leveransplats', '5369_03']);
      pdfDoc.setProducer('Winefeed Compliance System');
      pdfDoc.setCreator('Winefeed');
      pdfDoc.setModificationDate(new Date());

      // Flatten the form (make fields read-only)
      form.flatten();

      // ========================================================================
      // Generate PDF Buffer
      // ========================================================================

      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = Buffer.from(pdfBytes);

      // Compute SHA-256 hash
      const fileHash = crypto
        .createHash('sha256')
        .update(pdfBuffer)
        .digest('hex');

      return { pdfBuffer, fileHash };
    } catch (error: any) {
      throw new DDLDocumentGenerationError(
        `Failed to generate PDF: ${error.message}`,
        data.ddl_id
      );
    }
  }

}

// ============================================================================
// Export Singleton Instance
// ============================================================================

export const ddlDocumentGenerator = new DDLDocumentGenerator();
