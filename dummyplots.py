import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import re
import os

def generate_plots(csv_filename='data/agency.csv'):
    """
    Reads the specified CSV file and generates three types of plots:
    1. A radial plot for each agency, saved as [agency_name].png
    2. A single scatter plot for Warmth vs. Dominance.
    3. A single trend chart for all agencies across key metrics.
    """
    
    # --- 1. Load Data ---
    try:
        df_agency = pd.read_csv(csv_filename)
    except FileNotFoundError:
        print(f"Error: The file '{csv_filename}' was not found.")
        print("Please make sure the script is in the same directory as your CSV file.")
        return

    print(f"Successfully loaded '{csv_filename}'. Found {len(df_agency)} agencies.")

    # --- 2. Generate Radial Plots ---
    print("Generating radial plots for each agency...")

    # Categories for the radial plot (excluding Warmth and Dominance)
    # This automatically finds all columns *except* 'Agency', 'Warmth', 'Dominance'
    all_columns = df_agency.columns.tolist()
    categories = [
        col for col in all_columns 
        if col not in ['Agency', 'Warmth', 'Dominance']
    ]
    
    if not categories:
        print("Error: Could not find data columns for radial plots.")
        print("Expected columns like 'Competent', 'Reliable', etc.")
        return

    print(f"Using categories for radial plots: {categories}")
    num_vars = len(categories)

    # Compute angles for each axis
    angles = np.linspace(0, 2 * np.pi, num_vars, endpoint=False).tolist()
    angles += angles[:1]  # Complete the loop

    # Set the DataFrame index to 'Agency' for easy iteration
    df_radial = df_agency.set_index('Agency')

    # Find min/max for setting y-axis limits dynamically
    all_values = df_radial[categories].values.flatten()
    min_val = np.floor(all_values.min())
    max_val = np.ceil(all_values.max())
    # Add a little buffer
    min_val = max(0, min_val - 1)
    max_val = max_val + 1

    generated_radial_files = []

    for agency, row in df_radial.iterrows():
        # Get values for the agency
        values = row[categories].tolist()
        values += values[:1]  # Complete the loop

        fig, ax = plt.subplots(figsize=(6, 6), subplot_kw=dict(polar=True))
        
        # Draw the plot
        ax.plot(angles, values, color='blue', linewidth=2, label=agency)
        ax.fill(angles, values, color='blue', alpha=0.25)
        
        # Set the y-axis labels
        ax.set_rlabel_position(0)
        # Use dynamic min/max for y-axis
        ax.set_yticks(np.arange(min_val, max_val + 1, 1))
        ax.set_ylim(min_val, max_val)
        
        # Set the x-axis (category) labels
        ax.set_xticks(angles[:-1])
        ax.set_xticklabels(categories, size=12)
        
        ax.set_title(agency, size=16, color='black', y=1.1)
        
        # Clean up agency name for filename
        # Remove special characters and replace spaces with underscores
        safe_filename = re.sub(r'[^a-zA-Z0-9_ ]', '', agency)
        safe_filename = safe_filename.replace(' ', '_') + '.png'
        
        plt.savefig(safe_filename)
        plt.close(fig)
        generated_radial_files.append(safe_filename)

    print(f"Generated {len(generated_radial_files)} radial plots.")

    # --- 3. Generate XY Axis for Warmth and Dominance ---
    print("Generating Warmth vs. Dominance scatter plot...")

    plt.figure(figsize=(12, 10))
    if 'Warmth' in df_agency.columns and 'Dominance' in df_agency.columns:
        plt.scatter(df_agency['Warmth'], df_agency['Dominance'], s=50, color='red', alpha=0.7)

        # Add labels for each point
        for i, row in df_agency.iterrows():
            plt.text(row['Warmth'] + 0.5, row['Dominance'] + 0.5, row['Agency'], fontsize=9)

        plt.title('Agency Perceptions: Warmth vs. Dominance', fontsize=16)
        plt.xlabel('Warmth', fontsize=12)
        plt.ylabel('Dominance', fontsize=12)

        # Add quadrant lines
        plt.axhline(0, color='grey', linestyle='--', linewidth=0.5)
        plt.axvline(0, color='grey', linestyle='--', linewidth=0.5)

        plt.grid(True, linestyle=':', alpha=0.6)
        plt.savefig('warmth_dominance_scatter.png')
        plt.close()
        print("Generated warmth_dominance_scatter.png")
    else:
        print("Skipped: 'Warmth' or 'Dominance' columns not found in CSV.")

    # --- 4. Generate "Trend" Chart ---
    print("Generating trend chart...")

    plt.figure(figsize=(14, 8))

    # Use the same categories as the radial plot
    metrics = categories

    # Create a colormap
    colors = plt.cm.get_cmap('tab20', len(df_agency))

    for i, row in df_agency.iterrows():
        agency_name = row['Agency']
        values = row[metrics].values
        plt.plot(metrics, values, marker='o', linestyle='-', label=agency_name, color=colors(i))

    plt.title('Agency Performance Metrics', fontsize=16)
    plt.xlabel('Metric', fontsize=12)
    plt.ylabel('Score', fontsize=12)

    # Set y-axis limits based on data
    plt.ylim(min_val, max_val)

    # Add a legend outside the plot
    plt.legend(bbox_to_anchor=(1.04, 1), loc="upper left")

    plt.grid(True, linestyle=':', alpha=0.6)
    plt.tight_layout(rect=[0, 0, 0.85, 1]) # Adjust layout to make room for legend
    plt.savefig('agency_trend_chart.png')
    plt.close()

    print("Generated agency_trend_chart.png")
    print("\nAll tasks complete.")

# --- Main execution ---
if __name__ == "__main__":
    generate_plots(csv_filename='data/agency.csv')