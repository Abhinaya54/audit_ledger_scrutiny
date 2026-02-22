import pandas as pd
import numpy as np
import random
from faker import Faker
from config import *
from accounts import ACCOUNTS

fake = Faker()

def generate_log_amount():
    return round(np.random.lognormal(mean=8, sigma=1), 2)

def random_account():
    category = random.choice(list(ACCOUNTS.keys()))
    account = random.choice(ACCOUNTS[category])
    return category, account

def generate_gl_data():

    dates = pd.date_range(start=START_DATE, end=END_DATE)
    company_type = random.choice(COMPANY_TYPES)

    rows = []

    for i in range(NUM_TRANSACTIONS):

        date = random.choice(dates)
        amount = generate_log_amount()

        # Debit
        debit_category, debit_account = random_account()

        # Credit
        credit_category, credit_account = random_account()

        description = fake.sentence(nb_words=6)

        rows.append([
            i+1,
            date,
            debit_account,
            credit_account,
            amount,
            description,
            company_type
        ])

    df = pd.DataFrame(rows, columns=[
        "Transaction_ID",
        "Date",
        "Debit_Account",
        "Credit_Account",
        "Amount",
        "Description",
        "Company_Type"
    ])

    return df