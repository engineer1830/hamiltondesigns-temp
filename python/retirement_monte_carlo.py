import tkinter as tk
from tkinter import Frame, Label, Button, Entry, Text, END
import numpy as np
import numpy_financial as npf
from tabulate import tabulate
import yfinance as yf
import matplotlib.pyplot as plt


def sample_returns(stock_rate, bond_rate, stock_vol=0.15, bond_vol=0.05):
    """
    Draw random annual returns for stocks and bonds.
    """
    stock_r = np.random.normal(stock_rate, stock_vol)
    bond_r = np.random.normal(bond_rate, bond_vol)
    return stock_r, bond_r


def grow_one_year(
    lump_value,
    salary,
    investment_pct,
    stock_interest,
    bond_interest,
    stock_weight,
    bond_weight,
    salary_growth=0.02,
    inflation=0.0,
    randomize=False,
    stock_vol=0.15,
    bond_vol=0.05,
):
    """
    Grow the portfolio for one year with:
    - weighted stock/bond allocation
    - monthly contributions based on salary
    - optional random returns (Monte Carlo)
    - salary growth
    - inflation adjustment
    """

    if randomize:
        stock_interest, bond_interest = sample_returns(
            stock_interest, bond_interest, stock_vol, bond_vol
        )

    monthly_contribution = (salary / 12.0) * (investment_pct / 100.0)

    stock_lump = lump_value * stock_weight
    bond_lump = lump_value * bond_weight

    stock_contrib = monthly_contribution * stock_weight
    bond_contrib = monthly_contribution * bond_weight

    stock_future = npf.fv(stock_interest / 12.0, 12, -stock_contrib, -stock_lump)
    bond_future = npf.fv(bond_interest / 12.0, 12, -bond_contrib, -bond_lump)

    future_nominal = stock_future + bond_future
    future_real = future_nominal / (1.0 + inflation)

    next_salary = salary * (1.0 + salary_growth)

    return future_real, next_salary


def financial_performance(funds):
    """
    Sort funds, categorize as conservative and moderate/aggressive,
    and compute average annual returns for each category.
    """

    sorted_funds = sorted(funds.items(), key=lambda x: x[1]["avg_annual"])

    conservative = []
    moderate_aggressive = []

    for ticker, info in sorted_funds:
        if info["avg_annual"] < 0.06:
            conservative.append((ticker, info["avg_annual"]))
        else:
            moderate_aggressive.append((ticker, info["avg_annual"]))

    avg_conservative = (
        sum(r for _, r in conservative) / len(conservative) if conservative else 0.0
    )
    avg_moderate_aggressive = (
        sum(r for _, r in moderate_aggressive) / len(moderate_aggressive)
        if moderate_aggressive
        else 0.0
    )

    return sorted_funds, conservative, moderate_aggressive, avg_conservative, avg_moderate_aggressive


def simulate_retirement(
    age,
    gender,
    retire_age,
    lump_value,
    salary,
    investment_pct,
    stock_rate,
    bond_rate,
    salary_growth,
    inflation,
    withdraw_rate,
    monte_carlo=False,
    stock_vol=0.15,
    bond_vol=0.05,
):
    """
    Unified retirement simulation:
    - Aggressive phase (20–49): 100% stocks
    - Moderate phase (50–59): 65/35
    - Preserving pre-retirement (60–retire): 50/50
    - Withdrawals (retire–70): 50/50
    - Legacy (70–life expectancy): 35/65
    """

    legacy_data = []
    current_age = age
    current_lump = lump_value
    current_salary = salary

    after_aggressive = current_lump
    after_moderate = current_lump
    lump_at_retire = current_lump

    # Aggressive phase: 20–49, 100% stocks
    if retire_age > 20 and current_age < 50:
        start_age = max(current_age, 20)
        end_age = min(retire_age, 50)
        years = max(0, end_age - start_age)
        for _ in range(years):
            current_lump, current_salary = grow_one_year(
                current_lump,
                current_salary,
                investment_pct,
                stock_rate,
                bond_rate,
                stock_weight=1.0,
                bond_weight=0.0,
                salary_growth=salary_growth,
                inflation=inflation,
                randomize=monte_carlo,
                stock_vol=stock_vol,
                bond_vol=bond_vol,
            )
            current_age += 1
        after_aggressive = current_lump

    # Moderate phase: 50–59, 65/35
    if retire_age > 50 and current_age < 60:
        start_age = max(current_age, 50)
        end_age = min(retire_age, 60)
        years = max(0, end_age - start_age)
        for _ in range(years):
            current_lump, current_salary = grow_one_year(
                current_lump,
                current_salary,
                investment_pct,
                stock_rate,
                bond_rate,
                stock_weight=0.65,
                bond_weight=0.35,
                salary_growth=salary_growth,
                inflation=inflation,
                randomize=monte_carlo,
                stock_vol=stock_vol,
                bond_vol=bond_vol,
            )
            current_age += 1
        after_moderate = current_lump

    # Preserving pre-retirement: 60–retire, 50/50
    if retire_age > current_age:
        start_age = max(current_age, 60)
        end_age = retire_age
        years = max(0, end_age - start_age)
        for _ in range(years):
            current_lump, current_salary = grow_one_year(
                current_lump,
                current_salary,
                investment_pct,
                stock_rate,
                bond_rate,
                stock_weight=0.5,
                bond_weight=0.5,
                salary_growth=salary_growth,
                inflation=inflation,
                randomize=monte_carlo,
                stock_vol=stock_vol,
                bond_vol=bond_vol,
            )
            current_age += 1

    lump_at_retire = current_lump

    # Withdrawals from retire_age to 70, 50/50
    if current_age < 70:
        while current_age < 70:
            current_lump, _ = grow_one_year(
                current_lump,
                salary=0.0,
                investment_pct=0.0,
                stock_interest=stock_rate,
                bond_interest=bond_rate,
                stock_weight=0.5,
                bond_weight=0.5,
                salary_growth=0.0,
                inflation=inflation,
                randomize=monte_carlo,
                stock_vol=stock_vol,
                bond_vol=bond_vol,
            )
            withdraw_amount = current_lump * withdraw_rate
            current_lump -= withdraw_amount
            current_age += 1
            legacy_data.append((current_age, withdraw_amount, current_lump))

    # Legacy phase: 70–life expectancy, 35/65
    life_expectancy = 84 if gender == "m" else 86
    if current_age < life_expectancy:
        while current_age < life_expectancy:
            current_lump, _ = grow_one_year(
                current_lump,
                salary=0.0,
                investment_pct=0.0,
                stock_interest=stock_rate,
                bond_interest=bond_rate,
                stock_weight=0.35,
                bond_weight=0.65,
                salary_growth=0.0,
                inflation=inflation,
                randomize=monte_carlo,
                stock_vol=stock_vol,
                bond_vol=bond_vol,
            )
            withdraw_amount = current_lump * withdraw_rate
            current_lump -= withdraw_amount
            current_age += 1
            legacy_data.append((current_age, withdraw_amount, current_lump))

    final_legacy = current_lump

    return {
        "after_aggressive": after_aggressive,
        "after_moderate": after_moderate,
        "lump_at_retire": lump_at_retire,
        "final_legacy": final_legacy,
        "legacy_data": legacy_data,
    }


def monte_carlo_simulation(
    n_runs,
    age,
    gender,
    retire_age,
    lump_value,
    salary,
    investment_pct,
    stock_rate,
    bond_rate,
    salary_growth,
    inflation,
    withdraw_rate,
    stock_vol=0.15,
    bond_vol=0.05,
):
    results = []

    for _ in range(n_runs):
        sim = simulate_retirement(
            age=age,
            gender=gender,
            retire_age=retire_age,
            lump_value=lump_value,
            salary=salary,
            investment_pct=investment_pct,
            stock_rate=stock_rate,
            bond_rate=bond_rate,
            salary_growth=salary_growth,
            inflation=inflation,
            withdraw_rate=withdraw_rate,
            monte_carlo=True,
            stock_vol=stock_vol,
            bond_vol=bond_vol,
        )
        results.append(sim["final_legacy"])

    results = np.array(results)

    return {
        "median": np.median(results),
        "p10": np.percentile(results, 10),
        "p90": np.percentile(results, 90),
        "prob_ruin": np.mean(results <= 0),
        "all_results": results,
    }


def format_legacy_table(legacy_data):
    formatted = [
        (age, f"${withdrawn:,.2f}", f"${balance:,.2f}")
        for age, withdrawn, balance in legacy_data
    ]
    return tabulate(formatted, headers=["Age", "Withdrawn", "Balance"], tablefmt="github")


def plot_monte_carlo_distribution(results_array, target=2_000_000):
    """
    Enhanced Monte Carlo distribution plot with:
    - Median line
    - 10th / 25th / 75th / 90th percentiles
    - Mean vs median comparison
    - Probability of ending below a target
    """

    # Compute statistics
    mean_val = np.mean(results_array)
    median_val = np.median(results_array)
    p10 = np.percentile(results_array, 10)
    p25 = np.percentile(results_array, 25)
    p75 = np.percentile(results_array, 75)
    p90 = np.percentile(results_array, 90)
    prob_below_target = np.mean(results_array < target)

    plt.figure(figsize=(10, 6))
    plt.hist(results_array, bins=40, color="steelblue", edgecolor="black", alpha=0.7)

    # Percentile lines
    plt.axvline(p10, color="red", linestyle="--", linewidth=1.5, label="10th percentile")
    plt.axvline(p25, color="orange", linestyle="--", linewidth=1.5, label="25th percentile")
    plt.axvline(median_val, color="green", linestyle="-", linewidth=2.5, label="Median")
    plt.axvline(p75, color="orange", linestyle="--", linewidth=1.5, label="75th percentile")
    plt.axvline(p90, color="red", linestyle="--", linewidth=1.5, label="90th percentile")

    # Mean line
    plt.axvline(mean_val, color="purple", linestyle="-.", linewidth=2, label="Mean")

    # Shaded IQR region
    plt.axvspan(p25, p75, color="yellow", alpha=0.15, label="Interquartile Range (25–75%)")

    # Target threshold line
    plt.axvline(target, color="black", linestyle=":", linewidth=2, label=f"Target (${target:,.0f})")

    # Title and labels
    plt.title("Monte Carlo Final Legacy Distribution", fontsize=14)
    plt.xlabel("Final Legacy Balance", fontsize=12)
    plt.ylabel("Frequency", fontsize=12)

    # Probability annotation
    plt.text(
        0.02,
        0.95,
        f"Mean: ${mean_val:,.0f}\n"
        f"Median: ${median_val:,.0f}\n"
        f"10th pct: ${p10:,.0f}\n"
        f"90th pct: ${p90:,.0f}\n"
        f"Prob < ${target/1_000_000:.1f}M: {prob_below_target*100:.2f}%",
        transform=plt.gca().transAxes,
        fontsize=11,
        verticalalignment="top",
        bbox=dict(facecolor="white", alpha=0.8, edgecolor="gray")
    )

    plt.legend()
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.show()



def setup_main(root):
    frm = Frame(root)
    frm.master.title("Retirement Calculations with Monte Carlo")
    frm.pack(padx=3, pady=3, fill=tk.BOTH, expand=True)

    lbl_current_age = Label(frm, text="What is your current age? ")
    lbl_current_age.grid(row=0, column=0, padx=3, pady=3, sticky="w")
    ent_current_age = Entry(frm, width=5)
    ent_current_age.grid(row=0, column=1, padx=3, pady=3)

    lbl_gender = Label(frm, text="What is your gender (m/f)? ")
    lbl_gender.grid(row=1, column=0, padx=3, pady=3, sticky="w")
    ent_gender = Entry(frm, width=5)
    ent_gender.grid(row=1, column=1, padx=3, pady=3)

    lbl_retirement_age = Label(frm, text="What age do you plan to retire? ")
    lbl_retirement_age.grid(row=2, column=0, padx=3, pady=3, sticky="w")
    ent_retirement_age = Entry(frm, width=5)
    ent_retirement_age.grid(row=2, column=1, padx=3, pady=3)

    lbl_current_lump = Label(frm, text="How much retirement savings do you currently have? ")
    lbl_current_lump.grid(row=3, column=0, padx=3, pady=3, sticky="w")
    ent_current_lump = Entry(frm, width=12)
    ent_current_lump.grid(row=3, column=1, padx=3, pady=3)

    lbl_current_salary = Label(frm, text="What is your current annual salary?")
    lbl_current_salary.grid(row=4, column=0, padx=3, pady=3, sticky="w")
    ent_current_salary = Entry(frm, width=12)
    ent_current_salary.grid(row=4, column=1, padx=3, pady=3)

    lbl_investment = Label(
        frm,
        text='What percentage of your salary do you save for retirement? (for 10%, enter "10")',
        wraplength=300,
        justify="left",
    )
    lbl_investment.grid(row=5, column=0, padx=3, pady=3, sticky="w")
    ent_investment = Entry(frm, width=5)
    ent_investment.grid(row=5, column=1, padx=3, pady=3)

    lbl_tickers = Label(frm, text="Enter tickers separated by commas: ")
    lbl_tickers.grid(row=6, column=0, padx=3, pady=3, sticky="w")
    ent_tickers = Entry(frm, width=25)
    ent_tickers.grid(row=6, column=1, padx=3, pady=3)

    lbl_salary_growth = Label(frm, text="Annual salary growth rate (e.g., 2 for 2%)")
    lbl_salary_growth.grid(row=7, column=0, padx=3, pady=3, sticky="w")
    ent_salary_growth = Entry(frm, width=5)
    ent_salary_growth.grid(row=7, column=1, padx=3, pady=3)

    lbl_withdraw = Label(frm, text="Annual withdrawal rate in retirement (e.g., 5 for 5%)")
    lbl_withdraw.grid(row=8, column=0, padx=3, pady=3, sticky="w")
    ent_withdraw = Entry(frm, width=5)
    ent_withdraw.grid(row=8, column=1, padx=3, pady=3)

    lbl_inflation = Label(frm, text="Annual inflation rate (e.g., 2 for 2%)")
    lbl_inflation.grid(row=9, column=0, padx=3, pady=3, sticky="w")
    ent_inflation = Entry(frm, width=5)
    ent_inflation.grid(row=9, column=1, padx=3, pady=3)

    lbl_mc_runs = Label(frm, text="Monte Carlo runs (e.g., 1000)")
    lbl_mc_runs.grid(row=10, column=0, padx=3, pady=3, sticky="w")
    ent_mc_runs = Entry(frm, width=8)
    ent_mc_runs.grid(row=10, column=1, padx=3, pady=3)

    lbl_stock_vol = Label(frm, text="Stock volatility % (e.g., 15)")
    lbl_stock_vol.grid(row=11, column=0, padx=3, pady=3, sticky="w")
    ent_stock_vol = Entry(frm, width=8)
    ent_stock_vol.grid(row=11, column=1, padx=3, pady=3)

    lbl_bond_vol = Label(frm, text="Bond volatility % (e.g., 5)")
    lbl_bond_vol.grid(row=12, column=0, padx=3, pady=3, sticky="w")
    ent_bond_vol = Entry(frm, width=8)
    ent_bond_vol.grid(row=12, column=1, padx=3, pady=3)

    results_text = Text(frm, width=90, height=22)
    results_text.grid(row=13, column=0, columnspan=2, padx=3, pady=10)

    def process_inputs():
        results_text.delete("1.0", END)

        try:
            current_age = int(ent_current_age.get())
        except ValueError:
            results_text.insert(END, "Please enter a valid integer for current age.\n")
            return

        gender = ent_gender.get().strip().lower()
        if gender not in ("m", "f"):
            results_text.insert(END, "Please enter 'm' or 'f' for gender.\n")
            return

        try:
            retirement_age = int(ent_retirement_age.get())
        except ValueError:
            results_text.insert(END, "Please enter a valid integer for retirement age.\n")
            return

        try:
            current_lump = float(ent_current_lump.get().strip())
        except ValueError:
            results_text.insert(END, "Please enter a valid number for current retirement savings.\n")
            return

        try:
            current_salary = float(ent_current_salary.get().strip())
        except ValueError:
            results_text.insert(END, "Please enter a valid number for current salary.\n")
            return

        try:
            investment = float(ent_investment.get().strip())
        except ValueError:
            results_text.insert(END, "Please enter a valid percentage for investment.\n")
            return

        raw = ent_tickers.get()
        tickers = [t.strip().upper() for t in raw.split(",") if t.strip()]
        if not tickers:
            results_text.insert(END, "Please enter at least one ticker.\n")
            return

        try:
            salary_growth = float(ent_salary_growth.get().strip()) / 100.0
        except ValueError:
            results_text.insert(END, "Please enter a valid salary growth percentage.\n")
            return

        try:
            withdraw_rate = float(ent_withdraw.get().strip()) / 100.0
        except ValueError:
            results_text.insert(END, "Please enter a valid withdrawal percentage.\n")
            return

        try:
            inflation = float(ent_inflation.get().strip()) / 100.0
        except ValueError:
            results_text.insert(END, "Please enter a valid inflation percentage.\n")
            return

        try:
            mc_runs = int(ent_mc_runs.get().strip())
        except ValueError:
            results_text.insert(END, "Please enter a valid integer for Monte Carlo runs.\n")
            return

        try:
            stock_vol = float(ent_stock_vol.get().strip()) / 100.0
        except ValueError:
            results_text.insert(END, "Please enter a valid stock volatility percentage.\n")
            return

        try:
            bond_vol = float(ent_bond_vol.get().strip()) / 100.0
        except ValueError:
            results_text.insert(END, "Please enter a valid bond volatility percentage.\n")
            return

        # Load fund data
        funds = {}
        for t in tickers:
            data = yf.Ticker(t).history(period="max")
            if data.empty:
                results_text.insert(END, f"No data found for ticker {t}.\n")
                return

            prices = data["Adj Close"] if "Adj Close" in data.columns else data["Close"]
            returns = prices.pct_change().dropna()
            avg_daily = returns.mean()
            avg_annual = (1 + avg_daily) ** 252 - 1

            funds[t] = {
                "data": data,
                "prices": prices,
                "returns": returns,
                "avg_daily": avg_daily,
                "avg_annual": avg_annual,
                "start": data.index.min().date(),
                "end": data.index.max().date(),
            }

        sorted_funds, conservative, moderate_aggressive, avg_conservative, avg_moderate_aggressive = financial_performance(
            funds
        )

        results_text.insert(END, "\n***** Historical Performance Summary *****\n")
        for ticker, info in sorted_funds:
            results_text.insert(
                END,
                f"\n{ticker}:\n  Data covers: {info['start']} to {info['end']}\n"
                f"  Average daily return: {info['avg_daily']:.6f}\n"
                f"  Annualized average return: {info['avg_annual']:.4%}\n",
            )

        results_text.insert(END, "\n***** Conservative Funds (< 6%) *****\n")
        for ticker, r in conservative:
            results_text.insert(END, f"  {ticker}: {r:.2%}\n")

        results_text.insert(END, "\n***** Moderate to Aggressive Funds (>= 6%) *****\n")
        for ticker, r in moderate_aggressive:
            results_text.insert(END, f"  {ticker}: {r:.2%}\n")

        stock_rate = avg_moderate_aggressive
        bond_rate = avg_conservative

        sim = simulate_retirement(
            age=current_age,
            gender=gender,
            retire_age=retirement_age,
            lump_value=current_lump,
            salary=current_salary,
            investment_pct=investment,
            stock_rate=stock_rate,
            bond_rate=bond_rate,
            salary_growth=salary_growth,
            inflation=inflation,
            withdraw_rate=withdraw_rate,
            monte_carlo=False,
            stock_vol=stock_vol,
            bond_vol=bond_vol,
        )

        results_text.insert(END, "\n\n***** Deterministic Retirement Projection *****\n\n")
        results_text.insert(
            END,
            f"Starting savings: ${current_lump:,.2f}\n"
            f"Starting salary: ${current_salary:,.2f}\n"
            f"Salary invested: {investment:.1f}%\n"
            f"Salary growth: {salary_growth*100:.1f}% per year\n"
            f"Withdrawal rate: {withdraw_rate*100:.1f}% per year\n"
            f"Inflation: {inflation*100:.1f}% per year\n\n",
        )

        results_text.insert(
            END,
            f"Balance after aggressive phase: ${sim['after_aggressive']:,.2f}\n",
        )
        results_text.insert(
            END,
            f"Balance after moderate phase:  ${sim['after_moderate']:,.2f}\n",
        )
        results_text.insert(
            END,
            f"Balance at retirement (age {retirement_age}): ${sim['lump_at_retire']:,.2f}\n",
        )
        results_text.insert(
            END,
            f"Estimated remaining amount for heirs at life expectancy: ${sim['final_legacy']:,.2f}\n\n",
        )

        results_text.insert(END, "***** Withdrawal & Legacy Table (Deterministic) *****\n\n")
        results_text.insert(END, format_legacy_table(sim["legacy_data"]))
        results_text.insert(END, "\n")

        # Monte Carlo
        mc = monte_carlo_simulation(
            n_runs=mc_runs,
            age=current_age,
            gender=gender,
            retire_age=retirement_age,
            lump_value=current_lump,
            salary=current_salary,
            investment_pct=investment,
            stock_rate=stock_rate,
            bond_rate=bond_rate,
            salary_growth=salary_growth,
            inflation=inflation,
            withdraw_rate=withdraw_rate,
            stock_vol=stock_vol,
            bond_vol=bond_vol,
        )

        results_text.insert(END, "\n\n***** Monte Carlo Summary *****\n\n")
        results_text.insert(END, f"Runs: {mc_runs}\n")
        results_text.insert(END, f"Median final legacy: ${mc['median']:,.2f}\n")
        results_text.insert(END, f"10th percentile: ${mc['p10']:,.2f}\n")
        results_text.insert(END, f"90th percentile: ${mc['p90']:,.2f}\n")
        results_text.insert(END, f"Probability of ruin (<= 0): {mc['prob_ruin']*100:.2f}%\n")

        # Plot Monte Carlo distribution
        plot_monte_carlo_distribution(mc["all_results"])

    btn_click = Button(frm, text="Can I retire?", command=process_inputs)
    btn_click.grid(row=14, column=0, columnspan=2, pady=10, sticky="n")

    return frm


def main():
    root = tk.Tk()
    root.option_add("*Font", "Helvetica 11")
    setup_main(root)
    root.mainloop()


if __name__ == "__main__":
    main()
