# `vault-cli show`

Current smoke expectation:

- accepts queryable ids such as `evt_*`, `exp_*`, `smp_*`, `aud_*`, `core`, and `journal:<date>`
- rejects related ids like `meal_*`, `doc_*`, plus batch/derived ids like `xfm_*` and export-pack ids
- `links[].queryable` signals whether a related id is safe to pass back into `show`
