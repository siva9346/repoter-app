/**
 * Reporter App - Google Apps Script backend.
 *
 * Deploy this bound to a Google Sheet (Extensions > Apps Script), then
 * Deploy > New deployment > Web app, execute as "Me", access "Anyone".
 * Copy the /exec URL into the app's EXPO_PUBLIC_APPS_SCRIPT_URL env var.
 *
 * Sheets are created automatically on first run if missing.
 */

var REPORTS_SHEET = 'Sales Reports';
var CUSTOMERS_SHEET = 'Customers';
var STAYS_SHEET = 'Stay Locations';

var REPORTS_HEADERS = [
  'Report Id', 'Date', 'Sales Person', 'Employee Id', 'S.No', 'Travel Mode',
  'Departure', 'Start Time', 'Arrival', 'Arrival Time',
  'Distance KM', 'Bus Fare', 'Time At Customer', 'Met With', 'Key Feedback', 'Comments',
  'Follow Up Required', 'Departure Latitude', 'Departure Longitude',
  'Arrival Latitude', 'Arrival Longitude', 'Submitted At'
];

var CUSTOMERS_HEADERS = ['Name', 'Place', 'Address'];
var STAYS_HEADERS = ['Name', 'Place', 'Address'];

var SALESPERSONS_SHEET = 'Salespersons';
var SALESPERSONS_HEADERS = ['Name', 'Employee Id', 'Mobile Number', 'Updated At'];

function getSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetToObjects_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    rows.push(obj);
  }
  return rows;
}

function doGet(e) {
  try {
    var action = (e.parameter.action || '').toLowerCase();

    if (action === 'masters') {
      var customers = sheetToObjects_(getSheet_(CUSTOMERS_SHEET, CUSTOMERS_HEADERS));
      var stayLocations = sheetToObjects_(getSheet_(STAYS_SHEET, STAYS_HEADERS));
      return jsonOut_({ ok: true, customers: customers, stayLocations: stayLocations });
    }

    if (action === 'salespersons') {
      var salespersons = sheetToObjects_(getSheet_(SALESPERSONS_SHEET, SALESPERSONS_HEADERS));
      return jsonOut_({ ok: true, salespersons: salespersons });
    }

    if (action === 'reports') {
      var rows = sheetToObjects_(getSheet_(REPORTS_SHEET, REPORTS_HEADERS));
      var date = e.parameter.date;
      var salesPerson = e.parameter.salesPerson;
      var customer = e.parameter.customer;
      if (date) rows = rows.filter(function (r) { return formatDate_(r['Date']) === date; });
      if (salesPerson) rows = rows.filter(function (r) {
        return String(r['Sales Person']).toLowerCase().indexOf(salesPerson.toLowerCase()) !== -1;
      });
      if (customer) rows = rows.filter(function (r) {
        var dep = String(r['Departure']).toLowerCase();
        var arr = String(r['Arrival']).toLowerCase();
        var q = customer.toLowerCase();
        return dep.indexOf(q) !== -1 || arr.indexOf(q) !== -1;
      });
      return jsonOut_({ ok: true, reports: rows });
    }

    if (action === 'dashboard') {
      var allRows = sheetToObjects_(getSheet_(REPORTS_SHEET, REPORTS_HEADERS));
      return jsonOut_({ ok: true, reports: allRows });
    }

    return jsonOut_({ ok: true, message: 'Reporter App backend is running.' });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = (body.action || '').toLowerCase();

    if (action === 'submitreport') {
      return jsonOut_(submitReport_(body));
    }
    if (action === 'addcustomer') {
      return jsonOut_(addRow_(CUSTOMERS_SHEET, CUSTOMERS_HEADERS, body.customer));
    }
    if (action === 'addstaylocation') {
      return jsonOut_(addRow_(STAYS_SHEET, STAYS_HEADERS, body.stayLocation));
    }
    if (action === 'deletecustomer') {
      return jsonOut_(deleteRowByName_(CUSTOMERS_SHEET, CUSTOMERS_HEADERS, body.name));
    }
    if (action === 'deletestaylocation') {
      return jsonOut_(deleteRowByName_(STAYS_SHEET, STAYS_HEADERS, body.name));
    }
    if (action === 'savesalesperson') {
      return jsonOut_(saveSalesperson_(body.settings));
    }

    return jsonOut_({ ok: false, error: 'Unknown action: ' + body.action });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function addRow_(sheetName, headers, record) {
  if (!record || !record.name) return { ok: false, error: 'Missing name' };
  var sheet = getSheet_(sheetName, headers);
  sheet.appendRow([record.name, record.place || '', record.address || '']);
  return { ok: true };
}

function saveSalesperson_(settings) {
  if (!settings || !settings.salesPersonName) return { ok: false, error: 'Missing salesPersonName' };
  var sheet = getSheet_(SALESPERSONS_SHEET, SALESPERSONS_HEADERS);
  var values = sheet.getDataRange().getValues();
  var updatedAt = new Date();
  var row = [
    settings.salesPersonName,
    settings.employeeId || '',
    settings.mobileNumber || '',
    updatedAt
  ];
  // Upsert by name — Settings is a single profile per salesperson, so
  // saving again should update their existing row, not pile up duplicates
  // the way an append-only log (like visits) is supposed to.
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === settings.salesPersonName) {
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return { ok: true };
    }
  }
  sheet.appendRow(row);
  return { ok: true };
}

function deleteRowByName_(sheetName, headers, name) {
  var sheet = getSheet_(sheetName, headers);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === name) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Not found' };
}

function submitReport_(body) {
  var sheet = getSheet_(REPORTS_SHEET, REPORTS_HEADERS);
  var reportId = body.reportId || Utilities.getUuid();
  var date = body.date;
  var salesPerson = body.salesPerson;
  var employeeId = body.employeeId || '';
  var rows = body.rows || [];
  var submittedAt = new Date();

  rows.forEach(function (r) {
    sheet.appendRow([
      reportId, date, salesPerson, employeeId, r.sNo, r.travelMode || 'bike',
      r.departure, r.startTime, r.arrival, r.arrivalTime,
      r.distanceKm, r.busFare, r.timeAtCustomer, r.metWith, r.keyFeedback, r.comments,
      r.followUpRequired ? 'Yes' : 'No',
      r.departureLat, r.departureLng, r.arrivalLat, r.arrivalLng,
      submittedAt
    ]);
  });

  return { ok: true, reportId: reportId };
}

function formatDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value).slice(0, 10);
}
