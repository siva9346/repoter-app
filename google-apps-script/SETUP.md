# Google Sheets backend setup

The Reporter App stores all data in a Google Sheet through a Google Apps
Script Web App. This step needs your own Google account, so it can't be
automated — follow these steps once (~5 minutes):

1. Go to [sheets.google.com](https://sheets.google.com) and create a new
   blank spreadsheet. Name it something like **"Reporter App Data"**.
2. In the sheet, open **Extensions > Apps Script**.
3. Delete the placeholder `myFunction` code and paste in the full contents
   of [`Code.gs`](./Code.gs) from this folder.
4. Click **Save** (the disk icon), then **Deploy > New deployment**.
5. Click the gear icon next to "Select type" and choose **Web app**.
6. Configure:
   - **Execute as:** Me
   - **Who has access:** Anyone
7. Click **Deploy**. Authorize the script when prompted (click through the
   "Google hasn't verified this app" warning — it's your own script).
8. Copy the **Web app URL** shown (ends in `/exec`).
9. In the Reporter App project, create a `.env.local` file (copy
   `.env.example`) and set:

   ```
   EXPO_PUBLIC_APPS_SCRIPT_URL=https://script.google.com/macros/s/XXXXXXXX/exec
   ```

10. Restart the dev server with `npx expo start -c` (the `-c` clears the
    bundler cache) so the new env var is picked up.

The script auto-creates three sheets on first use: **Sales Reports**,
**Customers**, and **Stay Locations** — you don't need to create them by
hand.

## Updating the script later

If you change `Code.gs`, paste the updated code into the Apps Script editor
and create a **new deployment version** (Deploy > Manage deployments > edit
> New version), or the live Web App URL will keep running the old code.
