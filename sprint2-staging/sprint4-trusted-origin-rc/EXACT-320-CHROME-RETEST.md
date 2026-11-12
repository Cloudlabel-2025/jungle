# 320 px keyboard focus and reflow · Final localhost HTTPS candidate

**PASS** for the tested directory and Create alumni form in regular Windows Chrome. The isolated candidate at `https://127.0.0.1:3193` used SHA-256 `52360d59589e80d6c7fc7f5db6fef1497666918bc60cc2c4cd97f7d2c33d2dde`. Chrome Responsive mode showed a 320 CSS px viewport width.

| Check | Observed result | Screenshot |
| --- | --- | --- |
| Directory reflow | The heading, Create control and fictional record buttons fit within the viewport. Long labels wrapped. A horizontal scroll attempt did not move the page. Vertical scrolling reached the final rows. | [Directory top](exact-320-01-directory.png) · [Directory bottom](exact-320-07-directory-bottom.png) |
| Create keyboard entry | Tab reached Create alumni. Enter moved the visible focus outline to the form heading. | [Create trigger](exact-320-02-create-trigger.png) · [Focused heading](exact-320-03-create-heading.png) |
| First field | The next Tab moved focus to First name. | [First name focus](exact-320-04-first-name.png) |
| Form reflow and Cancel | Tab advanced through the form to Cancel. Both bottom actions were visible within the viewport. A horizontal scroll attempt did not move the form. | [Bottom of form and Cancel focus](exact-320-05-cancel.png) |
| Focus restoration | Enter on Cancel returned focus to Create alumni. The directory still had 20 records. | [Restored trigger focus](exact-320-06-restored-trigger.png) |

Reflow was checked visually and through browser scrolling for these two views. The browser signed out after the check. [Browser session trace](exact-320-browser-requests.json)

The temporary QA certificate was removed and the disposable endpoint stopped. Key 3 and Key 4 remain pending. The live game was untouched.
