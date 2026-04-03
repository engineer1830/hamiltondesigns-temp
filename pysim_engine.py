print("PyScript engine loaded")

import numpy as np

# ---- core helpers (adapted from your engine, no tkinter/yfinance) ----

def sample_returns(stock_rate, bond_rate, stock_vol=0.15, bond_vol=0.05):
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
    if randomize:
        stock_interest, bond_interest = sample_returns(
            stock_interest, bond_interest, stock_vol, bond_vol
        )

    monthly_contribution = (salary / 12.0) * (investment_pct / 100.0)

    stock_lump = lump_value * stock_weight
    bond_lump = lump_value * bond_weight

    stock_contrib = monthly_contribution * stock_weight
    bond_contrib = monthly_contribution * bond_weight

    # simple monthly compounding
    for _ in range(12):
        stock_lump = stock_lump * (1 + stock_interest / 12.0) + stock_contrib
        bond_lump = bond_lump * (1 + bond_interest / 12.0) + bond_contrib

    future_nominal = stock_lump + bond_lump
    future_real = future_nominal / (1.0 + inflation)

    next_salary = salary * (1.0 + salary_growth)

    return future_real, next_salary


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
    legacy_data = []
    current_age = age
    current_lump = lump_value
    current_salary = salary

    after_aggressive = current_lump
    after_moderate = current_lump
    lump_at_retire = current_lump

    balances_det = []
    withdrawals_det = []

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
            balances_det.append(current_lump)
            withdrawals_det.append(0.0)
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
            balances_det.append(current_lump)
            withdrawals_det.append(0.0)
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
            balances_det.append(current_lump)
            withdrawals_det.append(0.0)

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
            balances_det.append(current_lump)
            withdrawals_det.append(withdraw_amount)

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
            balances_det.append(current_lump)
            withdrawals_det.append(withdraw_amount)

    final_legacy = current_lump

    return {
        "after_aggressive": after_aggressive,
        "after_moderate": after_moderate,
        "lump_at_retire": lump_at_retire,
        "final_legacy": final_legacy,
        "legacy_data": legacy_data,
        "balances_det": balances_det,
        "withdrawals_det": withdrawals_det,
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
        "median": float(np.median(results)),
        "p10": float(np.percentile(results, 10)),
        "p90": float(np.percentile(results, 90)),
        "prob_ruin": float(np.mean(results <= 0)),
        "all_results": results.tolist(),
    }


def format_legacy_table(legacy_data):
    lines = ["Age | Withdrawn | Balance", "----|-----------|--------"]
    for age, withdrawn, balance in legacy_data:
        lines.append(f"{age} | ${withdrawn:,.2f} | ${balance:,.2f}")
    return "\n".join(lines)


def run_from_form(
    age,
    gender,
    retire_age,
    lump_value,
    salary,
    investment_pct,
    tickers,
    salary_growth,
    inflation,
    withdraw_rate,
    mc_runs,
    stock_vol,
    bond_vol,
):
    # For now, use fixed stock/bond rates; later we’ll plug yfinance/backend here.
    stock_rate = 0.08
    bond_rate = 0.03

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
        monte_carlo=False,
        stock_vol=stock_vol,
        bond_vol=bond_vol,
    )

    mc = monte_carlo_simulation(
        n_runs=mc_runs,
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
        stock_vol=stock_vol,
        bond_vol=bond_vol,
    )

    text_parts = []

    text_parts.append("***** Deterministic Retirement Projection *****\n")
    text_parts.append(
        f"Starting savings: ${lump_value:,.2f}\n"
        f"Starting salary: ${salary:,.2f}\n"
        f"Salary invested: {investment_pct:.1f}%\n"
        f"Salary growth: {salary_growth*100:.1f}% per year\n"
        f"Withdrawal rate: {withdraw_rate*100:.1f}% per year\n"
        f"Inflation: {inflation*100:.1f}% per year\n\n"
    )

    text_parts.append(
        f"Balance after aggressive phase: ${sim['after_aggressive']:,.2f}\n"
    )
    text_parts.append(
        f"Balance after moderate phase:  ${sim['after_moderate']:,.2f}\n"
    )
    text_parts.append(
        f"Balance at retirement (age {retire_age}): ${sim['lump_at_retire']:,.2f}\n"
    )
    text_parts.append(
        f"Estimated remaining amount for heirs at life expectancy: ${sim['final_legacy']:,.2f}\n\n"
    )

    text_parts.append("***** Withdrawal & Legacy Table (Deterministic) *****\n\n")
    text_parts.append(format_legacy_table(sim["legacy_data"]))
    text_parts.append("\n\n")

    text_parts.append("***** Monte Carlo Summary *****\n\n")
    text_parts.append(f"Runs: {mc_runs}\n")
    text_parts.append(f"Median final legacy: ${mc['median']:,.2f}\n")
    text_parts.append(f"10th percentile: ${mc['p10']:,.2f}\n")
    text_parts.append(f"90th percentile: ${mc['p90']:,.2f}\n")
    text_parts.append(f"Probability of ruin (<= 0): {mc['prob_ruin']*100:.2f}%\n")

    text_output = "".join(text_parts)

    # Data for charts
    charts = {
        "deterministic": {
            "balances": sim["balances_det"],
            "withdrawals": sim["withdrawals_det"],
        },
        "monte_carlo": {
            "final_legacy": mc["all_results"],
        },
    }

    return {
        "text_output": text_output,
        "charts": charts,
    }
