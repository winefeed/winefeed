const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

(async () => {
  console.log('Analyzing SKV 5369_03 form fields...\n');

  try {
    // Read the PDF form
    const formPath = './public/forms/skv_5369_03.pdf';
    const pdfBytes = fs.readFileSync(formPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Get the form
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    console.log(`Total fields found: ${fields.length}\n`);
    console.log('='.repeat(80));
    console.log('FIELD DETAILS');
    console.log('='.repeat(80));

    fields.forEach((field, index) => {
      const name = field.getName();
      const type = field.constructor.name;

      console.log(`\n${index + 1}. Field Name: "${name}"`);
      console.log(`   Type: ${type}`);

      // Try to get more info based on type
      try {
        if (type === 'PDFTextField') {
          const textField = form.getTextField(name);
          console.log(`   Max Length: ${textField.getMaxLength() || 'unlimited'}`);
          console.log(`   Text: "${textField.getText() || '(empty)'}"`);
        } else if (type === 'PDFCheckBox') {
          const checkbox = form.getCheckBox(name);
          console.log(`   Checked: ${checkbox.isChecked()}`);
        } else if (type === 'PDFDropdown') {
          const dropdown = form.getDropdown(name);
          console.log(`   Options: ${dropdown.getOptions().join(', ')}`);
          console.log(`   Selected: "${dropdown.getSelected() || '(none)'}"`);
        } else if (type === 'PDFRadioGroup') {
          const radioGroup = form.getRadioGroup(name);
          console.log(`   Options: ${radioGroup.getOptions().join(', ')}`);
          console.log(`   Selected: "${radioGroup.getSelected() || '(none)'}"`);
        }
      } catch (e) {
        console.log(`   (Could not read details: ${e.message})`);
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total fields: ${fields.length}`);

    const fieldTypes = {};
    fields.forEach(field => {
      const type = field.constructor.name;
      fieldTypes[type] = (fieldTypes[type] || 0) + 1;
    });

    console.log('\nField types:');
    Object.entries(fieldTypes).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}`);
    });

  } catch (error) {
    console.error('Error analyzing form:', error);
  }
})();
