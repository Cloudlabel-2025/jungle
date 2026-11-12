# OP15-A11Y-01 retest

PASS on the disposable focus-fix candidate at http://127.0.0.1:3189. The browser used a fictional administrator and a clean 20-record directory.

- At the 320 px viewport, pressing Enter on Create alumni focused the form heading. The next Tab focused First name. Pressing Enter on Cancel returned focus to the Create alumni button.
- At the default viewport, opening the form focused the heading again. Tab moved from LinkedIn URL to Save profile and then Cancel. Enter returned focus to Create alumni. The directory still contained 20 records.

The tested UI SHA-256 is d85e671d77f5f2c0324f90fe35816aa776e824a228053c0f41f992c4757f8054. The change was applied in a disposable source copy. The patch targets the staging UI and passes git apply --check against the pinned source. The original release fingerprint remains available for historical evidence.

[Patch](create-focus.patch) · [Browser focus observations](browser.json) · [Form heading](01-create-heading-focused.jpg) · [Restored focus](02-create-trigger-refocused.jpg)

Key 3 and Key 4 remain pending. CC still owns the S4-AC-02 decision for the final candidate.
