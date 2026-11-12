# Localhost HTTPS browser retest

PASS in regular Windows Chrome at https://127.0.0.1:3193 using the isolated Sprint 4 candidate with SHA-256 52360d59589e80d6c7fc7f5db6fef1497666918bc60cc2c4cd97f7d2c33d2dde.

Chrome reported a secure connection. The fictional administrator signed in and opened the 20-record directory. The browser's same-origin sign-in returned 200 and set the app cookie with Secure, HttpOnly, SameSite=Strict, Path=/ and Max-Age=3600. Chrome returned the cookie to the directory and session endpoints after reload. Sign-out returned 200 with Secure and Max-Age=0. After another reload, Chrome sent no session cookie and received 401 from the session endpoint.

The request trace records cookie attributes and presence only. It omits credentials and cookie values. The temporary one-day localhost QA trust certificate was removed and its absence verified. The disposable endpoint was stopped. Key 3 and Key 4 remain pending. The live game was untouched.

[Browser request trace](localhost-browser-requests.json) · [Secure connection](localhost-chrome-secure.png) · [Signed-in directory](localhost-chrome-signed-in.png) · [Signed out after reload](localhost-chrome-signed-out.png)
