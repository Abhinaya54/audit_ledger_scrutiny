import numpy as np

def inject_fraud(df, fraud_ratio=0.02):

    num_fraud = int(len(df) * fraud_ratio)

    fraud_indices = np.random.choice(df.index, num_fraud, replace=False)

    df["Fraud_Flag"] = 0

    # Pattern 1: Very large amount
    df.loc[fraud_indices, "Amount"] *= 10

    df.loc[fraud_indices, "Fraud_Flag"] = 1

    return df