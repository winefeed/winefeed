const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

(async () => {
  console.log('Analyzing SKV 5369_03 form structure...\n');

  try {
    const formPath = './public/forms/skv_5369_03.pdf';
    const pdfBytes = fs.readFileSync(formPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const form = pdfDoc.getForm();
    const pages = pdfDoc.getPages();
    const fields = form.getFields();

    console.log(`Total pages: ${pages.length}`);
    console.log(`Total form fields: ${fields.length}\n`);

    // Check each page
    pages.forEach((page, i) => {
      console.log(`Page ${i + 1}:`);
      console.log(`  Size: ${page.getWidth()} x ${page.getHeight()}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('ALL FIELD NAMES (in order)');
    console.log('='.repeat(80));

    fields.forEach((field, i) => {
      const name = field.getName();
      const type = field.constructor.name;
      console.log(`${i + 1}. [${type}] ${name}`);
    });

    // Check if there are any annotations or widgets
    console.log('\n' + '='.repeat(80));
    console.log('CHECKING FOR ANNOTATIONS ON EACH PAGE');
    console.log('='.repeat(80));

    pages.forEach((page, pageIndex) => {
      const annots = page.node.Annots();
      if (annots) {
        console.log(`\nPage ${pageIndex + 1} has annotations/widgets`);
      } else {
        console.log(`\nPage ${pageIndex + 1} has no annotations`);
      }
    });

  } catch (error) {
    console.error('Error:', error);
  }
})();
