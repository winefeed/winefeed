const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

(async () => {
  console.log('Detailed analysis of SKV 5369_03 form...\n');

  try {
    const formPath = './public/forms/skv_5369_03.pdf';
    const pdfBytes = fs.readFileSync(formPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const form = pdfDoc.getForm();
    const fields = form.getFields();

    console.log(`Total fields found: ${fields.length}\n`);

    // Group fields by section
    const sections = {};

    fields.forEach((field) => {
      const name = field.getName();

      // Extract section name (everything before the last field name)
      const parts = name.split('.');
      const lastPart = parts[parts.length - 1];
      const sectionName = parts.slice(0, -1).join('.');

      if (!sections[sectionName]) {
        sections[sectionName] = [];
      }

      sections[sectionName].push({
        fullName: name,
        fieldName: lastPart,
        type: field.constructor.name
      });
    });

    // Print grouped by section
    console.log('='.repeat(80));
    console.log('FIELDS GROUPED BY SECTION');
    console.log('='.repeat(80));

    Object.entries(sections).forEach(([sectionName, fields]) => {
      console.log(`\n[${sectionName}]`);
      fields.forEach((field, i) => {
        console.log(`  ${i + 1}. ${field.fieldName} (${field.type})`);
        console.log(`     Full: ${field.fullName}`);
      });
    });

    // Look for keywords
    console.log('\n' + '='.repeat(80));
    console.log('FIELDS CONTAINING "Kontakt" or "Telefon"');
    console.log('='.repeat(80));

    fields.forEach((field) => {
      const name = field.getName();
      if (name.toLowerCase().includes('kontakt') || name.toLowerCase().includes('telefon')) {
        console.log(`\n${name}`);
        console.log(`  Type: ${field.constructor.name}`);
      }
    });

  } catch (error) {
    console.error('Error:', error);
  }
})();
