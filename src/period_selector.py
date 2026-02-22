def select_period(df, start_date, end_date):
    mask = (df["Date"] >= start_date) & (df["Date"] <= end_date)
    return df.loc[mask]