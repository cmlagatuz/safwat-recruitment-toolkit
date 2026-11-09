# Toolkit navigation map

This is an authenticated single-page application. A search-engine sitemap would not describe its tool panels or enforce access. The in-app **R-04 Toolkit Guide** is the user-facing directory; this table is the developer map.

| Menu | Panel ID | Purpose |
| --- | --- | --- |
| R-00 Database | `panel-database` | Administration, imports, backups, health |
| R-01 Visa Report | `panel-visa` | Inventory, assignments, expiry reporting |
| R-02 Recruitment Pipeline | `panel-pipeline` | Candidate stages and recruitment details |
| R-03 Operations | `panel-operations` | Client summaries, follow-ups and deadlines |
| R-04 Toolkit Guide | `panel-guide` | Search and open tools permitted by current navigation |
| F-01 Offer Letter Creation | `panel-offer` | Template-driven offer letters |
| F-02 Extract Files by Type | `panel-extract` | File extraction |
| F-03 Sort Files into Folders | `panel-sort` | File organization |
| F-04 Batch Rename | `panel-rename` | Batch renaming |
| F-05 Create Folders from List | `panel-mkfolders` | Folder creation |
| F-06 List Files / Folders | `panel-list` | Directory listings |
| F-07 Merge PDFs by Folder | `panel-merge` | PDF merging |
| F-08 Word / PDF Conversion | `panel-convert` | Conversion workflow |
| F-09 Delete Word Files | `panel-delete` | Existing destructive-file confirmation workflow |

The guide invokes existing navigation buttons, excludes hidden/disabled buttons and rechecks visibility on click. It does not assign roles or grant permissions. Firebase rules remain the cloud access boundary. Desktop File System Access restrictions still apply.

The legacy layers also create auxiliary screens (account management, health, CEO reports, record editors and CLAIRE) dynamically. Their code is catalogued in [MODULE_MAP.md](MODULE_MAP.md); they are not separate URLs.
