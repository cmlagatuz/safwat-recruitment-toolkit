# Module map

The application shell loads classic scripts in the same order as before extraction. Numeric prefixes are execution/cascade order, not versions. Keep these scripts classic: top-level declarations and existing inline handlers share globals.

## Maintained modules

| File | Responsibility |
| --- | --- |
| `public/index.html` | Page structure, tool panels and ordered asset references |
| `public/js/toolkit-core.js` | Pure data, dates, validation, CSV and operations calculations |
| `public/js/persistence.js` | Immutable snapshots, revision checks and dirty-data guard |
| `public/js/operations.js` | Read-only Operations dashboard |
| `public/js/toolkit-guide.js` | Searchable permission-aware tool directory |
| `public/css/operations.css` | Operations layout and print styling |
| `database.rules.json` | Server-enforced access and write validation |

## Preserved legacy JavaScript

These files were extracted without changing their content. Consolidate one feature at a time, with regression tests. Older overrides are not assumed redundant.

| Order | File | Lines at extraction |
| --- | --- | --- |
| 001 | [safwatperfgovernorv601](../public/js/legacy/001-safwatperfgovernorv601.js) | 114 |
| 002 | [initfirebaseearly](../public/js/legacy/002-initfirebaseearly.js) | 26 |
| 003 | [document-addeventlistener-domcontentloaded-function](../public/js/legacy/003-document-addeventlistener-domcontentloaded-function.js) | 167 |
| 004 | [navigation](../public/js/legacy/004-navigation.js) | 435 |
| 005 | [shared-helpers-for-report-dashboards-r-01-r-02](../public/js/legacy/005-shared-helpers-for-report-dashboards-r-01-r-02.js) | 2225 |
| 006 | [enterpriselayer](../public/js/legacy/006-enterpriselayer.js) | 782 |
| 007 | [enterprisev21](../public/js/legacy/007-enterprisev21.js) | 783 |
| 008 | [enterprisev22](../public/js/legacy/008-enterprisev22.js) | 545 |
| 009 | [hotfixv243](../public/js/legacy/009-hotfixv243.js) | 139 |
| 010 | [hotfixv245](../public/js/legacy/010-hotfixv245.js) | 66 |
| 011 | [cloudfirstv250](../public/js/legacy/011-cloudfirstv250.js) | 314 |
| 012 | [hotfixv251](../public/js/legacy/012-hotfixv251.js) | 186 |
| 013 | [hotfixv253](../public/js/legacy/013-hotfixv253.js) | 146 |
| 014 | [hotfixv254](../public/js/legacy/014-hotfixv254.js) | 6 |
| 015 | [accountapprovalv260](../public/js/legacy/015-accountapprovalv260.js) | 423 |
| 016 | [businessoverhaulv280](../public/js/legacy/016-businessoverhaulv280.js) | 846 |
| 017 | [hotfixv281](../public/js/legacy/017-hotfixv281.js) | 93 |
| 018 | [hotfixv284](../public/js/legacy/018-hotfixv284.js) | 188 |
| 019 | [hotfixv285](../public/js/legacy/019-hotfixv285.js) | 65 |
| 020 | [hotfixv286](../public/js/legacy/020-hotfixv286.js) | 68 |
| 021 | [hotfixv288](../public/js/legacy/021-hotfixv288.js) | 271 |
| 022 | [console-log-c-sidebar-scroll-lock-v2-8-9-active-color-3f6c4d-font](../public/js/legacy/022-console-log-c-sidebar-scroll-lock-v2-8-9-active-color-3f6c4d-font.js) | 2 |
| 023 | [hotfixv2810](../public/js/legacy/023-hotfixv2810.js) | 39 |
| 024 | [hotfixv2811](../public/js/legacy/024-hotfixv2811.js) | 54 |
| 025 | [hotfixv2812](../public/js/legacy/025-hotfixv2812.js) | 48 |
| 026 | [hotfixv2813](../public/js/legacy/026-hotfixv2813.js) | 27 |
| 027 | [console-log-c-sidebar-typography-v2-8-14-active-color-b98a2e-font](../public/js/legacy/027-console-log-c-sidebar-typography-v2-8-14-active-color-b98a2e-font.js) | 2 |
| 028 | [visatablev2815](../public/js/legacy/028-visatablev2815.js) | 265 |
| 029 | [visabulkv2816](../public/js/legacy/029-visabulkv2816.js) | 266 |
| 030 | [hotfixv2821](../public/js/legacy/030-hotfixv2821.js) | 175 |
| 031 | [visabulkv2823](../public/js/legacy/031-visabulkv2823.js) | 317 |
| 032 | [hotfixv2824](../public/js/legacy/032-hotfixv2824.js) | 37 |
| 033 | [stickyvisav2825](../public/js/legacy/033-stickyvisav2825.js) | 187 |
| 034 | [hotfixv2826](../public/js/legacy/034-hotfixv2826.js) | 76 |
| 035 | [hotfixv2827](../public/js/legacy/035-hotfixv2827.js) | 243 |
| 036 | [hotfixv2828](../public/js/legacy/036-hotfixv2828.js) | 203 |
| 037 | [hotfixv2829](../public/js/legacy/037-hotfixv2829.js) | 276 |
| 038 | [hotfixv2830](../public/js/legacy/038-hotfixv2830.js) | 96 |
| 039 | [hotfixv2832](../public/js/legacy/039-hotfixv2832.js) | 99 |
| 040 | [preflightr00hide](../public/js/legacy/040-preflightr00hide.js) | 11 |
| 041 | [hotfixv2833](../public/js/legacy/041-hotfixv2833.js) | 211 |
| 042 | [console-log-c-hide-send-diagnostic-from-super-admin-v2-8-34-activ](../public/js/legacy/042-console-log-c-hide-send-diagnostic-from-super-admin-v2-8-34-activ.js) | 2 |
| 043 | [hotfixv2835](../public/js/legacy/043-hotfixv2835.js) | 185 |
| 044 | [hotfixv2836](../public/js/legacy/044-hotfixv2836.js) | 132 |
| 045 | [hotfixv2837](../public/js/legacy/045-hotfixv2837.js) | 173 |
| 046 | [preflightforcer01](../public/js/legacy/046-preflightforcer01.js) | 21 |
| 047 | [hotfixv2838](../public/js/legacy/047-hotfixv2838.js) | 86 |
| 048 | [hotfixv2839](../public/js/legacy/048-hotfixv2839.js) | 250 |
| 049 | [hotfixv2840](../public/js/legacy/049-hotfixv2840.js) | 103 |
| 050 | [bulkvisav2846](../public/js/legacy/050-bulkvisav2846.js) | 288 |
| 051 | [hotfixv2847](../public/js/legacy/051-hotfixv2847.js) | 63 |
| 052 | [unifiedaddvisav2851](../public/js/legacy/052-unifiedaddvisav2851.js) | 331 |
| 053 | [approvalpolicyv2852](../public/js/legacy/053-approvalpolicyv2852.js) | 167 |
| 054 | [globalapprovalv2853](../public/js/legacy/054-globalapprovalv2853.js) | 110 |
| 055 | [sponsorandeditfixv2911](../public/js/legacy/055-sponsorandeditfixv2911.js) | 260 |
| 056 | [autoexpirev2912](../public/js/legacy/056-autoexpirev2912.js) | 91 |
| 057 | [r02v2936](../public/js/legacy/057-r02v2936.js) | 128 |
| 058 | [visaintelv2939](../public/js/legacy/058-visaintelv2939.js) | 185 |
| 059 | [vupbv2950](../public/js/legacy/059-vupbv2950.js) | 115 |
| 060 | [addremainingv2955](../public/js/legacy/060-addremainingv2955.js) | 96 |
| 061 | [vupbexportv2966](../public/js/legacy/061-vupbexportv2966.js) | 152 |
| 062 | [expexportv2961](../public/js/legacy/062-expexportv2961.js) | 86 |
| 063 | [restorev2965](../public/js/legacy/063-restorev2965.js) | 72 |
| 064 | [agencyfilterv2972](../public/js/legacy/064-agencyfilterv2972.js) | 122 |
| 065 | [r02v2979](../public/js/legacy/065-r02v2979.js) | 73 |
| 066 | [r01v300](../public/js/legacy/066-r01v300.js) | 71 |
| 067 | [viewdatar01v311](../public/js/legacy/067-viewdatar01v311.js) | 256 |
| 068 | [viewdatar02v320](../public/js/legacy/068-viewdatar02v320.js) | 160 |
| 069 | [entuniversalexport](../public/js/legacy/069-entuniversalexport.js) | 353 |
| 070 | [editcaseformv330](../public/js/legacy/070-editcaseformv330.js) | 209 |
| 071 | [editablecombov324](../public/js/legacy/071-editablecombov324.js) | 82 |
| 072 | [function-try-const-h-location-hash-tolowercase-replace-a-z-g-if-h](../public/js/legacy/072-function-try-const-h-location-hash-tolowercase-replace-a-z-g-if-h.js) | 1 |
| 073 | [ceodashboardv360](../public/js/legacy/073-ceodashboardv360.js) | 347 |
| 074 | [duplicateguardv367](../public/js/legacy/074-duplicateguardv367.js) | 131 |
| 075 | [ceoexecutivelayerv371](../public/js/legacy/075-ceoexecutivelayerv371.js) | 300 |
| 076 | [vupbclientpickerv370](../public/js/legacy/076-vupbclientpickerv370.js) | 162 |
| 077 | [ceov381](../public/js/legacy/077-ceov381.js) | 277 |
| 078 | [ceov393](../public/js/legacy/078-ceov393.js) | 343 |
| 079 | [pasteblankfixv401](../public/js/legacy/079-pasteblankfixv401.js) | 187 |
| 080 | [entcorev410](../public/js/legacy/080-entcorev410.js) | 121 |
| 081 | [safwatfixesv411](../public/js/legacy/081-safwatfixesv411.js) | 186 |
| 082 | [r02filtersearchv424](../public/js/legacy/082-r02filtersearchv424.js) | 214 |
| 083 | [r01filtersconsolidatedv425](../public/js/legacy/083-r01filtersconsolidatedv425.js) | 181 |
| 084 | [restorevupbexpv430](../public/js/legacy/084-restorevupbexpv430.js) | 93 |
| 085 | [r00controlcenterv431](../public/js/legacy/085-r00controlcenterv431.js) | 249 |
| 086 | [stickyreturnfixv440](../public/js/legacy/086-stickyreturnfixv440.js) | 56 |
| 087 | [safwatv440](../public/js/legacy/087-safwatv440.js) | 172 |
| 088 | [safwatv450](../public/js/legacy/088-safwatv450.js) | 161 |
| 089 | [safwatv460](../public/js/legacy/089-safwatv460.js) | 156 |
| 090 | [crudvalidationv500](../public/js/legacy/090-crudvalidationv500.js) | 112 |
| 091 | [r01phase1v510](../public/js/legacy/091-r01phase1v510.js) | 100 |
| 092 | [r01viewdataphase2v521](../public/js/legacy/092-r01viewdataphase2v521.js) | 121 |
| 093 | [qiwatogglefixv530](../public/js/legacy/093-qiwatogglefixv530.js) | 71 |
| 094 | [r01viewdataphase3v547](../public/js/legacy/094-r01viewdataphase3v547.js) | 142 |
| 095 | [visanumberautofillfixv548](../public/js/legacy/095-visanumberautofillfixv548.js) | 34 |
| 096 | [r01candvisaexpiryv550](../public/js/legacy/096-r01candvisaexpiryv550.js) | 83 |
| 097 | [globaldownloadfixv570](../public/js/legacy/097-globaldownloadfixv570.js) | 60 |
| 098 | [clairestep1](../public/js/legacy/098-clairestep1.js) | 522 |
| 099 | [clairealigndatesv730](../public/js/legacy/099-clairealigndatesv730.js) | 106 |
| 100 | [clairechatv740](../public/js/legacy/100-clairechatv740.js) | 462 |
| 101 | [clairefreebrainv752](../public/js/legacy/101-clairefreebrainv752.js) | 514 |
| 102 | [clairelocalbrainv760](../public/js/legacy/102-clairelocalbrainv760.js) | 951 |
| 103 | [darkchartsv771](../public/js/legacy/103-darkchartsv771.js) | 18 |

## Stylesheets

The 67 legacy stylesheets remain in their original cascade positions. Their paths, extraction checksums and baseline line locations are in [asset-manifest.json](asset-manifest.json). Historical patch explanations are in [LEGACY_NOTES.md](LEGACY_NOTES.md).

## How to find code

Use `rg "functionName|elementId" public/js public/css public/index.html`. Edit the source file directly; no bundling/build step is required. Do not rerun the extraction script over the already split shell.
