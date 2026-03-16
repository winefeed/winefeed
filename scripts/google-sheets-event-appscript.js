/**
 * Google Apps Script — Event Sheet Writer + Updater
 *
 * ACTIONS:
 *   add    — append new row (default)
 *   update — find row by titel and update specified fields
 *   delete — find row by titel and delete it
 *   list   — return all rows as JSON
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const action = data.action || 'add';

    if (action === 'add') {
      var adress = data.adress || '';
      var koordinat = '';
      if (adress) {
        try {
          var geo = Maps.newGeocoder().geocode(adress);
          if (geo.results && geo.results.length > 0) {
            var loc = geo.results[0].geometry.location;
            koordinat = loc.lat + ', ' + loc.lng;
          }
        } catch (geoErr) {
          koordinat = ''; // Silently fail
        }
      }
      sheet.appendRow([
        data.typ || 'Offline',
        data.titel || '',
        data.vard || '',
        data.datum || '',
        data.tid || '',
        data.plats || '',
        adress,
        koordinat,
        data.pris || '',
        data.beskrivning_event || '',
        data.beskrivning_vard || '',
        data.lank || '',
        data.bild || '',
        data.viner || '',
        '',
      ]);
      return _json({ success: true, message: 'Event added', koordinat: koordinat });
    }

    if (action === 'update') {
      var row = _findRow(sheet, data.titel);
      if (!row) return _json({ success: false, error: 'Row not found: ' + data.titel });

      // Column mapping (1-indexed)
      var cols = { typ:1, titel:2, vard:3, datum:4, tid:5, plats:6, adress:7, koordinat:8, pris:9, beskrivning_event:10, beskrivning_vard:11, lank:12, bild:13, viner:14 };

      var updated = [];
      for (var key in cols) {
        if (data[key] !== undefined && key !== 'titel') {
          sheet.getRange(row, cols[key]).setValue(data[key]);
          updated.push(key);
        }
      }
      return _json({ success: true, message: 'Updated row ' + row, fields: updated });
    }

    if (action === 'delete') {
      var row = _findRow(sheet, data.titel);
      if (!row) return _json({ success: false, error: 'Row not found: ' + data.titel });
      sheet.deleteRow(row);
      return _json({ success: true, message: 'Deleted row ' + row });
    }

    if (action === 'list') {
      var allData = sheet.getDataRange().getValues();
      var headers = allData[0];
      var rows = [];
      for (var i = 1; i < allData.length; i++) {
        var obj = {};
        for (var j = 0; j < headers.length; j++) {
          obj[headers[j]] = allData[i][j];
        }
        rows.push(obj);
      }
      return _json({ success: true, rows: rows });
    }

    return _json({ success: false, error: 'Unknown action: ' + action });

  } catch (err) {
    return _json({ success: false, error: err.toString() });
  }
}

function doGet(e) {
  return _json({ status: 'ok', message: 'Event Sheet API is running' });
}

// Find row number by titel (column B)
function _findRow(sheet, titel) {
  var data = sheet.getRange('B:B').getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === titel) return i + 1;
  }
  return null;
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
