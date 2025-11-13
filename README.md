# VizPublicTrust

Final project for CSCI2370: Interdisciplinary Scientific Visualization

## Quick Tutorial

This project provides two interactive views for exploring public trust in government agencies. Both pages load a default `agency.csv` file, and both allow you to load your own data using the "Load New CSV" button in the header.

### 1. UMAP Explorer (`index.html`)

This is the main page for a high-level overview of the agency landscape.

- **What it does:** Runs a UMAP algorithm in your browser to cluster agencies based on their 5 trust dimensions.

- **How to read it:**

  - **X-Axis (Left to Right):** Represents the **Overall Trust** score. Agencies further to the right are more trusted.

  - **Color:** Represents **Warmth** (Blue = Cold, Red = Warm).

  - **Border Thickness:** Represents **Dominance** (Thicker = More Dominant).

  - **Hover:** Hover over any agency to see a detailed card with all its metrics.

- **Info Button (i):** Hover the "i" icon in the top-right to see definitions for all metrics.

### 2. Radial/Bar Views (`radial.html`)

This page is for a detailed, direct comparison between specific agencies.

- **How to use it:**

  1. Use the dropdown in the left-side control panel to select an agency.

  2. Click **"+ Add to Comparison"** to add it to the charts.

  3. Repeat this process to add multiple agencies.

  4. Click the **"×"** button next to an agency's name to remove it.

- **The Charts:**

  - **Radial Chart:** Compares the 5 dimensions of trust (`Competent`, `Reliable`, etc.) for all selected agencies.

  - **Bar Chart:** Compares `Warmth` and `Dominance` for all selected agencies.

### Data Requirement

To use the "Load New CSV" feature, your file **must** contain the following columns (case-sensitive):

- `Agency`

- `Competent`

- `Reliable`

- `Ethical`

- `Sincere`

- `Benevolent`

- `Warmth`

- `Dominance`
