
(function HotfixV2847(){
  'use strict';
  const V = '2.8.47';
  const log = (...a) => console.log('%c[v2.8.47]', 'color:#8C6A22;font-weight:bold', ...a);
  const Toast = () => window.Toast || { ok:console.log, warn:console.warn, err:console.error, info:console.info };

  /* Override the template downloader with the new 12-column layout */
  window.downloadVisaTemplate = function() {
    if (typeof XLSX === 'undefined') {
      Toast().err('Excel library missing');
      return;
    }
    const headers = [
      'Visa Document Number',
      'Sponsor ID',
      'CR Number',
      'Company Name',
      'Nationality',
      'Stamping City',
      'Gender',
      'Visa Category',
      'Client',
      'Status (Visa)',
      'QIWA Visa Date (Hijri, yyyy/mm/dd)',
      'Registered Agency Name',
    ];
    const sample = [
      '1304524234',
      '4001234567',
      '2050174515',
      'Safwat Al Khaleej Company',
      'FILIPINO',
      'Riyadh',
      'MALE',
      'WELDER',
      'OSC',
      'ALLOCATED',
      '1447/07/01',
      'Greenearth Agency',
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 3, 18) }));
    XLSX.utils.book_append_sheet(wb, ws, 'Visa Records');
    XLSX.writeFile(wb, 'Visa_Bulk_Add_Template_v2.8.47.xlsx');
    log('Template downloaded with Stamping City column');
  };

  /* Make sure the parser recognizes Stamping City variants */
  if (window.BULK_VISA_ALIASES) {
    window.BULK_VISA_ALIASES.stampingCity = [
      'stamping city',
      'city (stamping city)',
      'city',
      'stampingcity',
      'stamping',
    ];
    log('Stamping City aliases registered');
  }

  console.log('%c🏙 Stamping City in bulk template v' + V + ' active', 'color:#8C6A22;font-weight:bold;');
})();
