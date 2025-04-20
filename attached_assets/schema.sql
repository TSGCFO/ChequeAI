--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: allocate_customer_deposit(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.allocate_customer_deposit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    remaining_amount DECIMAL(10, 2);
    current_transaction RECORD;
    allocation_amount DECIMAL(10, 2);
BEGIN
    -- Start with the full deposit amount
    remaining_amount := NEW.amount;
    
    -- Loop through unpaid transactions for this customer (oldest first)
    FOR current_transaction IN 
        SELECT 
            transaction_id, 
            net_payable_to_customer - paid_to_customer AS unpaid_amount
        FROM 
            cheque_transactions
        WHERE 
            customer_id = NEW.customer_id
            AND net_payable_to_customer > paid_to_customer
        ORDER BY 
            date ASC, transaction_id ASC
    LOOP
        -- Skip if all allocated
        IF remaining_amount <= 0 THEN
            EXIT;
        END IF;
        
        -- Determine how much to allocate to this transaction
        IF remaining_amount >= current_transaction.unpaid_amount THEN
            allocation_amount := current_transaction.unpaid_amount;
        ELSE
            allocation_amount := remaining_amount;
        END IF;
        
        -- Create allocation record
        INSERT INTO customer_deposit_allocations (
            deposit_id, transaction_id, amount
        ) VALUES (
            NEW.deposit_id, current_transaction.transaction_id, allocation_amount
        );
        
        -- Update transaction paid amount
        UPDATE cheque_transactions
        SET paid_to_customer = paid_to_customer + allocation_amount
        WHERE transaction_id = current_transaction.transaction_id;
        
        -- Reduce remaining amount
        remaining_amount := remaining_amount - allocation_amount;
    END LOOP;
    
    -- Mark deposit as fully allocated if no remaining amount
    IF remaining_amount <= 0 THEN
        UPDATE customer_deposits
        SET fully_allocated = TRUE
        WHERE deposit_id = NEW.deposit_id;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.allocate_customer_deposit() OWNER TO postgres;

--
-- Name: allocate_profit_withdrawal(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.allocate_profit_withdrawal() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    remaining_amount DECIMAL(10, 2);
    current_transaction RECORD;
    allocation_amount DECIMAL(10, 2);
BEGIN
    -- Start with the full withdrawal amount
    remaining_amount := NEW.amount;
    
    -- Loop through transactions with unwithdrawn profit (oldest first)
    FOR current_transaction IN 
        SELECT 
            transaction_id, 
            profit - profit_withdrawn AS unwithdrawn_amount
        FROM 
            cheque_transactions
        WHERE 
            profit > profit_withdrawn
            AND vendor_id IS NOT NULL
        ORDER BY 
            date ASC, transaction_id ASC
    LOOP
        -- Skip if all allocated
        IF remaining_amount <= 0 THEN
            EXIT;
        END IF;
        
        -- Determine how much to allocate to this transaction
        IF remaining_amount >= current_transaction.unwithdrawn_amount THEN
            allocation_amount := current_transaction.unwithdrawn_amount;
        ELSE
            allocation_amount := remaining_amount;
        END IF;
        
        -- Create allocation record
        INSERT INTO profit_withdrawal_allocations (
            withdrawal_id, transaction_id, amount
        ) VALUES (
            NEW.withdrawal_id, current_transaction.transaction_id, allocation_amount
        );
        
        -- Update transaction withdrawn amount
        UPDATE cheque_transactions
        SET profit_withdrawn = profit_withdrawn + allocation_amount
        WHERE transaction_id = current_transaction.transaction_id;
        
        -- Reduce remaining amount
        remaining_amount := remaining_amount - allocation_amount;
    END LOOP;
    
    -- Mark withdrawal as fully allocated if no remaining amount
    IF remaining_amount <= 0 THEN
        UPDATE profit_withdrawals
        SET fully_allocated = TRUE
        WHERE withdrawal_id = NEW.withdrawal_id;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.allocate_profit_withdrawal() OWNER TO postgres;

--
-- Name: allocate_vendor_payment(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.allocate_vendor_payment() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    remaining_amount DECIMAL(10, 2);
    current_transaction RECORD;
    allocation_amount DECIMAL(10, 2);
BEGIN
    -- Start with the full payment amount
    remaining_amount := NEW.amount;
    
    -- Loop through unpaid transactions for this vendor (oldest first)
    FOR current_transaction IN 
        SELECT 
            transaction_id, 
            amount_to_receive_from_vendor - received_from_vendor AS unreceived_amount
        FROM 
            cheque_transactions
        WHERE 
            vendor_id = NEW.vendor_id
            AND amount_to_receive_from_vendor > received_from_vendor
        ORDER BY 
            date ASC, transaction_id ASC
    LOOP
        -- Skip if all allocated
        IF remaining_amount <= 0 THEN
            EXIT;
        END IF;
        
        -- Determine how much to allocate to this transaction
        IF remaining_amount >= current_transaction.unreceived_amount THEN
            allocation_amount := current_transaction.unreceived_amount;
        ELSE
            allocation_amount := remaining_amount;
        END IF;
        
        -- Create allocation record
        INSERT INTO vendor_payment_allocations (
            payment_id, transaction_id, amount
        ) VALUES (
            NEW.payment_id, current_transaction.transaction_id, allocation_amount
        );
        
        -- Update transaction received amount
        UPDATE cheque_transactions
        SET received_from_vendor = received_from_vendor + allocation_amount
        WHERE transaction_id = current_transaction.transaction_id;
        
        -- Reduce remaining amount
        remaining_amount := remaining_amount - allocation_amount;
    END LOOP;
    
    -- Mark payment as fully allocated if no remaining amount
    IF remaining_amount <= 0 THEN
        UPDATE vendor_payments
        SET fully_allocated = TRUE
        WHERE payment_id = NEW.payment_id;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.allocate_vendor_payment() OWNER TO postgres;

--
-- Name: calculate_transaction_fields(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_transaction_fields() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    customer_fee_percentage DECIMAL(5, 2);
    vendor_fee_percentage DECIMAL(5, 2);
BEGIN
    -- Get customer fee percentage
    SELECT fee_percentage INTO customer_fee_percentage
    FROM customers
    WHERE customer_id = NEW.customer_id;
    
    -- Calculate customer fee and net payable
    NEW.customer_fee := NEW.cheque_amount * (customer_fee_percentage / 100);
    NEW.net_payable_to_customer := NEW.cheque_amount - NEW.customer_fee;
    
    -- If vendor ID is provided, calculate vendor-related fields
    IF NEW.vendor_id IS NOT NULL THEN
        -- Get vendor fee percentage
        SELECT fee_percentage INTO vendor_fee_percentage
        FROM vendors
        WHERE vendor_id = NEW.vendor_id;
        
        -- Calculate vendor fee, amount to receive, and profit
        NEW.vendor_fee := NEW.cheque_amount * (vendor_fee_percentage / 100);
        NEW.amount_to_receive_from_vendor := NEW.cheque_amount - NEW.vendor_fee;
        NEW.profit := NEW.cheque_amount * ((customer_fee_percentage - vendor_fee_percentage) / 100);
    ELSE
        -- Clear vendor-related fields if no vendor
        NEW.vendor_fee := NULL;
        NEW.amount_to_receive_from_vendor := NULL;
        NEW.profit := NULL;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.calculate_transaction_fields() OWNER TO postgres;

--
-- Name: generate_vendor_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_vendor_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    prefix VARCHAR(3);
    next_num INTEGER;
BEGIN
    prefix := UPPER(SUBSTRING(NEW.vendor_name, 1, 3));
    prefix := REGEXP_REPLACE(prefix, '[^A-Za-z]', '', 'g');
    
    IF LENGTH(prefix) = 0 THEN
        prefix := 'VND';
    ELSIF LENGTH(prefix) < 3 THEN
        prefix := RPAD(prefix, 3, 'X');
    END IF;
    
    next_num := NEXTVAL('vendor_id_seq');
    NEW.vendor_id := prefix || next_num;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.generate_vendor_id() OWNER TO postgres;

--
-- Name: update_modified_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_modified_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_modified_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cheque_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cheque_transactions (
    transaction_id integer NOT NULL,
    date date DEFAULT CURRENT_DATE,
    customer_id integer NOT NULL,
    cheque_number character varying(50) NOT NULL,
    cheque_amount numeric(10,2) NOT NULL,
    customer_fee numeric(10,2),
    net_payable_to_customer numeric(10,2),
    vendor_id character varying(20) NOT NULL,
    vendor_fee numeric(10,2),
    amount_to_receive_from_vendor numeric(10,2),
    profit numeric(10,2),
    paid_to_customer numeric(10,2) DEFAULT 0,
    received_from_vendor numeric(10,2) DEFAULT 0,
    profit_withdrawn numeric(10,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cheque_transactions_cheque_amount_check CHECK ((cheque_amount > (0)::numeric))
);


ALTER TABLE public.cheque_transactions OWNER TO postgres;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    customer_id integer NOT NULL,
    customer_name character varying(255) NOT NULL,
    contact_info character varying(255),
    fee_percentage numeric(5,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT customers_fee_percentage_check CHECK ((fee_percentage >= (0)::numeric))
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: vendors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendors (
    vendor_id character varying(20) NOT NULL,
    vendor_name character varying(255) NOT NULL,
    fee_percentage numeric(5,2) NOT NULL,
    contact_info character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT vendors_fee_percentage_check CHECK ((fee_percentage >= (0)::numeric))
);


ALTER TABLE public.vendors OWNER TO postgres;

--
-- Name: business_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.business_summary AS
 SELECT ( SELECT count(*) AS count
           FROM public.cheque_transactions) AS total_transactions,
    ( SELECT count(DISTINCT customers.customer_id) AS count
           FROM public.customers) AS total_customers,
    ( SELECT count(DISTINCT vendors.vendor_id) AS count
           FROM public.vendors) AS total_vendors,
    ( SELECT COALESCE(sum(cheque_transactions.cheque_amount), (0)::numeric) AS "coalesce"
           FROM public.cheque_transactions) AS total_cheque_amount,
    ( SELECT COALESCE(sum(cheque_transactions.net_payable_to_customer), (0)::numeric) AS "coalesce"
           FROM public.cheque_transactions) AS total_payable_to_customers,
    ( SELECT COALESCE(sum(cheque_transactions.paid_to_customer), (0)::numeric) AS "coalesce"
           FROM public.cheque_transactions) AS total_paid_to_customers,
    ( SELECT COALESCE(sum((cheque_transactions.net_payable_to_customer - cheque_transactions.paid_to_customer)), (0)::numeric) AS "coalesce"
           FROM public.cheque_transactions) AS total_outstanding_to_customers,
    ( SELECT COALESCE(sum(cheque_transactions.amount_to_receive_from_vendor), (0)::numeric) AS "coalesce"
           FROM public.cheque_transactions
          WHERE (cheque_transactions.vendor_id IS NOT NULL)) AS total_receivable_from_vendors,
    ( SELECT COALESCE(sum(cheque_transactions.received_from_vendor), (0)::numeric) AS "coalesce"
           FROM public.cheque_transactions) AS total_received_from_vendors,
    ( SELECT COALESCE(sum((cheque_transactions.amount_to_receive_from_vendor - cheque_transactions.received_from_vendor)), (0)::numeric) AS "coalesce"
           FROM public.cheque_transactions
          WHERE (cheque_transactions.vendor_id IS NOT NULL)) AS total_outstanding_from_vendors,
    ( SELECT COALESCE(sum(cheque_transactions.profit), (0)::numeric) AS "coalesce"
           FROM public.cheque_transactions) AS total_potential_profit,
    ( SELECT COALESCE(sum(cheque_transactions.profit_withdrawn), (0)::numeric) AS "coalesce"
           FROM public.cheque_transactions) AS total_realized_profit,
    ( SELECT COALESCE(sum((cheque_transactions.profit - cheque_transactions.profit_withdrawn)), (0)::numeric) AS "coalesce"
           FROM public.cheque_transactions) AS total_unrealized_profit;


ALTER VIEW public.business_summary OWNER TO postgres;

--
-- Name: cheque_transactions_transaction_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cheque_transactions_transaction_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cheque_transactions_transaction_id_seq OWNER TO postgres;

--
-- Name: cheque_transactions_transaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cheque_transactions_transaction_id_seq OWNED BY public.cheque_transactions.transaction_id;


--
-- Name: customer_balances; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.customer_balances AS
 SELECT c.customer_id,
    c.customer_name,
    sum(ct.net_payable_to_customer) AS total_owed,
    sum(ct.paid_to_customer) AS total_paid,
    sum((ct.net_payable_to_customer - ct.paid_to_customer)) AS remaining_balance
   FROM (public.customers c
     JOIN public.cheque_transactions ct ON ((c.customer_id = ct.customer_id)))
  GROUP BY c.customer_id, c.customer_name;


ALTER VIEW public.customer_balances OWNER TO postgres;

--
-- Name: customer_deposit_allocations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_deposit_allocations (
    allocation_id integer NOT NULL,
    deposit_id integer,
    transaction_id integer,
    amount numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT customer_deposit_allocations_amount_check CHECK ((amount > (0)::numeric))
);


ALTER TABLE public.customer_deposit_allocations OWNER TO postgres;

--
-- Name: customer_deposit_allocations_allocation_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customer_deposit_allocations_allocation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_deposit_allocations_allocation_id_seq OWNER TO postgres;

--
-- Name: customer_deposit_allocations_allocation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customer_deposit_allocations_allocation_id_seq OWNED BY public.customer_deposit_allocations.allocation_id;


--
-- Name: customer_deposits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_deposits (
    deposit_id integer NOT NULL,
    customer_id integer NOT NULL,
    date date DEFAULT CURRENT_DATE,
    amount numeric(10,2) NOT NULL,
    notes text,
    fully_allocated boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT customer_deposits_amount_check CHECK ((amount > (0)::numeric))
);


ALTER TABLE public.customer_deposits OWNER TO postgres;

--
-- Name: customer_deposit_allocations_detail; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.customer_deposit_allocations_detail AS
 SELECT cda.allocation_id,
    cd.deposit_id,
    cd.date AS deposit_date,
    c.customer_name,
    cd.amount AS total_deposit_amount,
    cda.amount AS allocated_amount,
    ct.transaction_id,
    ct.cheque_number,
    ct.date AS transaction_date,
    ct.cheque_amount,
    ct.net_payable_to_customer,
    ct.paid_to_customer,
    (ct.net_payable_to_customer - ct.paid_to_customer) AS remaining_balance
   FROM (((public.customer_deposit_allocations cda
     JOIN public.customer_deposits cd ON ((cda.deposit_id = cd.deposit_id)))
     JOIN public.customers c ON ((cd.customer_id = c.customer_id)))
     JOIN public.cheque_transactions ct ON ((cda.transaction_id = ct.transaction_id)))
  ORDER BY cd.date DESC, cda.allocation_id;


ALTER VIEW public.customer_deposit_allocations_detail OWNER TO postgres;

--
-- Name: customer_deposits_deposit_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customer_deposits_deposit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_deposits_deposit_id_seq OWNER TO postgres;

--
-- Name: customer_deposits_deposit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customer_deposits_deposit_id_seq OWNED BY public.customer_deposits.deposit_id;


--
-- Name: customer_deposits_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.customer_deposits_summary AS
 SELECT c.customer_id,
    c.customer_name,
    date_trunc('month'::text, (cd.date)::timestamp with time zone) AS month,
    count(cd.deposit_id) AS deposit_count,
    sum(cd.amount) AS total_deposit_amount,
    sum(
        CASE
            WHEN cd.fully_allocated THEN cd.amount
            ELSE (0)::numeric
        END) AS fully_allocated_amount,
    sum(
        CASE
            WHEN (NOT cd.fully_allocated) THEN cd.amount
            ELSE (0)::numeric
        END) AS not_fully_allocated_amount
   FROM (public.customers c
     JOIN public.customer_deposits cd ON ((c.customer_id = cd.customer_id)))
  GROUP BY c.customer_id, c.customer_name, (date_trunc('month'::text, (cd.date)::timestamp with time zone))
  ORDER BY c.customer_name, (date_trunc('month'::text, (cd.date)::timestamp with time zone));


ALTER VIEW public.customer_deposits_summary OWNER TO postgres;

--
-- Name: customer_detailed_transactions; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.customer_detailed_transactions AS
 SELECT c.customer_id,
    c.customer_name,
    ct.transaction_id,
    ct.date,
    ct.cheque_number,
    ct.cheque_amount,
    c.fee_percentage,
    ct.customer_fee,
    ct.net_payable_to_customer,
    ct.paid_to_customer,
    (ct.net_payable_to_customer - ct.paid_to_customer) AS remaining_balance,
        CASE
            WHEN (ct.net_payable_to_customer <= ct.paid_to_customer) THEN 'Fully Paid'::text
            WHEN (ct.paid_to_customer > (0)::numeric) THEN 'Partially Paid'::text
            ELSE 'Pending'::text
        END AS payment_status
   FROM (public.customers c
     JOIN public.cheque_transactions ct ON ((c.customer_id = ct.customer_id)))
  ORDER BY c.customer_name, ct.date;


ALTER VIEW public.customer_detailed_transactions OWNER TO postgres;

--
-- Name: customers_customer_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customers_customer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customers_customer_id_seq OWNER TO postgres;

--
-- Name: customers_customer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customers_customer_id_seq OWNED BY public.customers.customer_id;


--
-- Name: daily_profit_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.daily_profit_summary AS
 SELECT ct.date,
    sum(ct.profit) AS total_potential_profit,
    sum(ct.profit_withdrawn) AS total_realized_profit,
    sum((ct.profit - ct.profit_withdrawn)) AS unrealized_profit,
    count(DISTINCT ct.transaction_id) AS transaction_count
   FROM public.cheque_transactions ct
  GROUP BY ct.date
  ORDER BY ct.date;


ALTER VIEW public.daily_profit_summary OWNER TO postgres;

--
-- Name: monthly_profit_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.monthly_profit_summary AS
 SELECT date_trunc('month'::text, (ct.date)::timestamp with time zone) AS month,
    sum(ct.profit) AS total_potential_profit,
    sum(ct.profit_withdrawn) AS total_realized_profit,
    sum((ct.profit - ct.profit_withdrawn)) AS unrealized_profit,
    count(DISTINCT ct.transaction_id) AS transaction_count
   FROM public.cheque_transactions ct
  GROUP BY (date_trunc('month'::text, (ct.date)::timestamp with time zone))
  ORDER BY (date_trunc('month'::text, (ct.date)::timestamp with time zone));


ALTER VIEW public.monthly_profit_summary OWNER TO postgres;

--
-- Name: outstanding_balances; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.outstanding_balances AS
 SELECT 'Customer Balance'::text AS balance_type,
    c.customer_name AS name,
    sum((ct.net_payable_to_customer - ct.paid_to_customer)) AS outstanding_amount
   FROM (public.customers c
     JOIN public.cheque_transactions ct ON ((c.customer_id = ct.customer_id)))
  WHERE (ct.net_payable_to_customer > ct.paid_to_customer)
  GROUP BY c.customer_name
UNION ALL
 SELECT 'Vendor Balance'::text AS balance_type,
    v.vendor_name AS name,
    sum((ct.amount_to_receive_from_vendor - ct.received_from_vendor)) AS outstanding_amount
   FROM (public.vendors v
     JOIN public.cheque_transactions ct ON (((v.vendor_id)::text = (ct.vendor_id)::text)))
  WHERE (ct.amount_to_receive_from_vendor > ct.received_from_vendor)
  GROUP BY v.vendor_name
  ORDER BY 1, 3 DESC;


ALTER VIEW public.outstanding_balances OWNER TO postgres;

--
-- Name: profit_by_customer; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.profit_by_customer AS
 SELECT c.customer_id,
    c.customer_name,
    sum(ct.profit) AS total_potential_profit,
    sum(ct.profit_withdrawn) AS total_realized_profit,
    sum((ct.profit - ct.profit_withdrawn)) AS unrealized_profit,
    count(DISTINCT ct.transaction_id) AS transaction_count
   FROM (public.customers c
     JOIN public.cheque_transactions ct ON ((c.customer_id = ct.customer_id)))
  GROUP BY c.customer_id, c.customer_name
  ORDER BY (sum(ct.profit)) DESC;


ALTER VIEW public.profit_by_customer OWNER TO postgres;

--
-- Name: profit_by_vendor; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.profit_by_vendor AS
 SELECT v.vendor_id,
    v.vendor_name,
    sum(ct.profit) AS total_potential_profit,
    sum(ct.profit_withdrawn) AS total_realized_profit,
    sum((ct.profit - ct.profit_withdrawn)) AS unrealized_profit,
    count(DISTINCT ct.transaction_id) AS transaction_count
   FROM (public.vendors v
     JOIN public.cheque_transactions ct ON (((v.vendor_id)::text = (ct.vendor_id)::text)))
  GROUP BY v.vendor_id, v.vendor_name
  ORDER BY (sum(ct.profit)) DESC;


ALTER VIEW public.profit_by_vendor OWNER TO postgres;

--
-- Name: profit_withdrawal_allocations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profit_withdrawal_allocations (
    allocation_id integer NOT NULL,
    withdrawal_id integer,
    transaction_id integer,
    amount numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT profit_withdrawal_allocations_amount_check CHECK ((amount > (0)::numeric))
);


ALTER TABLE public.profit_withdrawal_allocations OWNER TO postgres;

--
-- Name: profit_withdrawal_allocations_allocation_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.profit_withdrawal_allocations_allocation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.profit_withdrawal_allocations_allocation_id_seq OWNER TO postgres;

--
-- Name: profit_withdrawal_allocations_allocation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.profit_withdrawal_allocations_allocation_id_seq OWNED BY public.profit_withdrawal_allocations.allocation_id;


--
-- Name: profit_withdrawals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profit_withdrawals (
    withdrawal_id integer NOT NULL,
    date date DEFAULT CURRENT_DATE,
    amount numeric(10,2) NOT NULL,
    notes text,
    fully_allocated boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT profit_withdrawals_amount_check CHECK ((amount > (0)::numeric))
);


ALTER TABLE public.profit_withdrawals OWNER TO postgres;

--
-- Name: profit_withdrawals_withdrawal_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.profit_withdrawals_withdrawal_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.profit_withdrawals_withdrawal_id_seq OWNER TO postgres;

--
-- Name: profit_withdrawals_withdrawal_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.profit_withdrawals_withdrawal_id_seq OWNED BY public.profit_withdrawals.withdrawal_id;


--
-- Name: transaction_status_report; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.transaction_status_report AS
 SELECT ct.transaction_id,
    ct.date,
    c.customer_name,
    ct.cheque_number,
    ct.cheque_amount,
    ct.net_payable_to_customer,
    ct.paid_to_customer,
    (ct.net_payable_to_customer - ct.paid_to_customer) AS remaining_to_customer,
        CASE
            WHEN (ct.net_payable_to_customer <= ct.paid_to_customer) THEN 'Fully Paid'::text
            WHEN (ct.paid_to_customer > (0)::numeric) THEN 'Partially Paid'::text
            ELSE 'Pending'::text
        END AS customer_payment_status,
    v.vendor_name,
    ct.amount_to_receive_from_vendor,
    ct.received_from_vendor,
    (ct.amount_to_receive_from_vendor - ct.received_from_vendor) AS remaining_from_vendor,
        CASE
            WHEN (ct.amount_to_receive_from_vendor <= ct.received_from_vendor) THEN 'Fully Received'::text
            WHEN (ct.received_from_vendor > (0)::numeric) THEN 'Partially Received'::text
            ELSE 'Pending'::text
        END AS vendor_payment_status,
    ct.profit,
    ct.profit_withdrawn,
    (ct.profit - ct.profit_withdrawn) AS unrealized_profit,
        CASE
            WHEN (ct.profit <= ct.profit_withdrawn) THEN 'Fully Realized'::text
            WHEN (ct.profit_withdrawn > (0)::numeric) THEN 'Partially Realized'::text
            ELSE 'Unrealized'::text
        END AS profit_status,
        CASE
            WHEN ((ct.net_payable_to_customer <= ct.paid_to_customer) AND ((ct.amount_to_receive_from_vendor IS NULL) OR (ct.amount_to_receive_from_vendor <= ct.received_from_vendor)) AND ((ct.profit IS NULL) OR (ct.profit <= ct.profit_withdrawn))) THEN 'Completed'::text
            WHEN ((ct.paid_to_customer > (0)::numeric) OR (ct.received_from_vendor > (0)::numeric) OR (ct.profit_withdrawn > (0)::numeric)) THEN 'In Progress'::text
            ELSE 'New'::text
        END AS overall_status
   FROM ((public.cheque_transactions ct
     JOIN public.customers c ON ((ct.customer_id = ct.customer_id)))
     LEFT JOIN public.vendors v ON (((ct.vendor_id)::text = (ct.vendor_id)::text)))
  ORDER BY ct.date DESC, ct.transaction_id;


ALTER VIEW public.transaction_status_report OWNER TO postgres;

--
-- Name: vendor_balances; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vendor_balances AS
 SELECT v.vendor_id,
    v.vendor_name,
    sum(ct.amount_to_receive_from_vendor) AS total_to_receive,
    sum(ct.received_from_vendor) AS total_received,
    sum((ct.amount_to_receive_from_vendor - ct.received_from_vendor)) AS pending_amount
   FROM (public.vendors v
     JOIN public.cheque_transactions ct ON (((v.vendor_id)::text = (ct.vendor_id)::text)))
  GROUP BY v.vendor_id, v.vendor_name;


ALTER VIEW public.vendor_balances OWNER TO postgres;

--
-- Name: vendor_detailed_transactions; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vendor_detailed_transactions AS
 SELECT v.vendor_id,
    v.vendor_name,
    ct.transaction_id,
    ct.date,
    ct.cheque_number,
    ct.cheque_amount,
    v.fee_percentage,
    ct.vendor_fee,
    ct.amount_to_receive_from_vendor,
    ct.received_from_vendor,
    (ct.amount_to_receive_from_vendor - ct.received_from_vendor) AS remaining_balance,
        CASE
            WHEN (ct.amount_to_receive_from_vendor <= ct.received_from_vendor) THEN 'Fully Received'::text
            WHEN (ct.received_from_vendor > (0)::numeric) THEN 'Partially Received'::text
            ELSE 'Pending'::text
        END AS payment_status
   FROM (public.vendors v
     JOIN public.cheque_transactions ct ON (((v.vendor_id)::text = (ct.vendor_id)::text)))
  ORDER BY v.vendor_name, ct.date;


ALTER VIEW public.vendor_detailed_transactions OWNER TO postgres;

--
-- Name: vendor_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vendor_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vendor_id_seq OWNER TO postgres;

--
-- Name: vendor_payment_allocations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendor_payment_allocations (
    allocation_id integer NOT NULL,
    payment_id integer,
    transaction_id integer,
    amount numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT vendor_payment_allocations_amount_check CHECK ((amount > (0)::numeric))
);


ALTER TABLE public.vendor_payment_allocations OWNER TO postgres;

--
-- Name: vendor_payment_allocations_allocation_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vendor_payment_allocations_allocation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vendor_payment_allocations_allocation_id_seq OWNER TO postgres;

--
-- Name: vendor_payment_allocations_allocation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vendor_payment_allocations_allocation_id_seq OWNED BY public.vendor_payment_allocations.allocation_id;


--
-- Name: vendor_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendor_payments (
    payment_id integer NOT NULL,
    vendor_id character varying(20) NOT NULL,
    date date DEFAULT CURRENT_DATE,
    amount numeric(10,2) NOT NULL,
    notes text,
    fully_allocated boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT vendor_payments_amount_check CHECK ((amount > (0)::numeric))
);


ALTER TABLE public.vendor_payments OWNER TO postgres;

--
-- Name: vendor_payment_allocations_detail; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vendor_payment_allocations_detail AS
 SELECT vpa.allocation_id,
    vp.payment_id,
    vp.date AS payment_date,
    v.vendor_name,
    vp.amount AS total_payment_amount,
    vpa.amount AS allocated_amount,
    ct.transaction_id,
    ct.cheque_number,
    ct.date AS transaction_date,
    ct.cheque_amount,
    ct.amount_to_receive_from_vendor,
    ct.received_from_vendor,
    (ct.amount_to_receive_from_vendor - ct.received_from_vendor) AS remaining_balance
   FROM (((public.vendor_payment_allocations vpa
     JOIN public.vendor_payments vp ON ((vpa.payment_id = vp.payment_id)))
     JOIN public.vendors v ON (((vp.vendor_id)::text = (v.vendor_id)::text)))
     JOIN public.cheque_transactions ct ON ((vpa.transaction_id = ct.transaction_id)))
  ORDER BY vp.date DESC, vpa.allocation_id;


ALTER VIEW public.vendor_payment_allocations_detail OWNER TO postgres;

--
-- Name: vendor_payments_payment_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vendor_payments_payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vendor_payments_payment_id_seq OWNER TO postgres;

--
-- Name: vendor_payments_payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vendor_payments_payment_id_seq OWNED BY public.vendor_payments.payment_id;


--
-- Name: vendor_payments_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vendor_payments_summary AS
 SELECT v.vendor_id,
    v.vendor_name,
    date_trunc('month'::text, (vp.date)::timestamp with time zone) AS month,
    count(vp.payment_id) AS payment_count,
    sum(vp.amount) AS total_payment_amount,
    sum(
        CASE
            WHEN vp.fully_allocated THEN vp.amount
            ELSE (0)::numeric
        END) AS fully_allocated_amount,
    sum(
        CASE
            WHEN (NOT vp.fully_allocated) THEN vp.amount
            ELSE (0)::numeric
        END) AS not_fully_allocated_amount
   FROM (public.vendors v
     JOIN public.vendor_payments vp ON (((v.vendor_id)::text = (vp.vendor_id)::text)))
  GROUP BY v.vendor_id, v.vendor_name, (date_trunc('month'::text, (vp.date)::timestamp with time zone))
  ORDER BY v.vendor_name, (date_trunc('month'::text, (vp.date)::timestamp with time zone));


ALTER VIEW public.vendor_payments_summary OWNER TO postgres;

--
-- Name: weekly_profit_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.weekly_profit_summary AS
 SELECT date_trunc('week'::text, (ct.date)::timestamp with time zone) AS week,
    sum(ct.profit) AS total_potential_profit,
    sum(ct.profit_withdrawn) AS total_realized_profit,
    sum((ct.profit - ct.profit_withdrawn)) AS unrealized_profit,
    count(DISTINCT ct.transaction_id) AS transaction_count
   FROM public.cheque_transactions ct
  GROUP BY (date_trunc('week'::text, (ct.date)::timestamp with time zone))
  ORDER BY (date_trunc('week'::text, (ct.date)::timestamp with time zone));


ALTER VIEW public.weekly_profit_summary OWNER TO postgres;

--
-- Name: cheque_transactions transaction_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cheque_transactions ALTER COLUMN transaction_id SET DEFAULT nextval('public.cheque_transactions_transaction_id_seq'::regclass);


--
-- Name: customer_deposit_allocations allocation_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_deposit_allocations ALTER COLUMN allocation_id SET DEFAULT nextval('public.customer_deposit_allocations_allocation_id_seq'::regclass);


--
-- Name: customer_deposits deposit_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_deposits ALTER COLUMN deposit_id SET DEFAULT nextval('public.customer_deposits_deposit_id_seq'::regclass);


--
-- Name: customers customer_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers ALTER COLUMN customer_id SET DEFAULT nextval('public.customers_customer_id_seq'::regclass);


--
-- Name: profit_withdrawal_allocations allocation_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profit_withdrawal_allocations ALTER COLUMN allocation_id SET DEFAULT nextval('public.profit_withdrawal_allocations_allocation_id_seq'::regclass);


--
-- Name: profit_withdrawals withdrawal_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profit_withdrawals ALTER COLUMN withdrawal_id SET DEFAULT nextval('public.profit_withdrawals_withdrawal_id_seq'::regclass);


--
-- Name: vendor_payment_allocations allocation_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_payment_allocations ALTER COLUMN allocation_id SET DEFAULT nextval('public.vendor_payment_allocations_allocation_id_seq'::regclass);


--
-- Name: vendor_payments payment_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_payments ALTER COLUMN payment_id SET DEFAULT nextval('public.vendor_payments_payment_id_seq'::regclass);


--
-- Name: cheque_transactions cheque_transactions_cheque_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cheque_transactions
    ADD CONSTRAINT cheque_transactions_cheque_number_key UNIQUE (cheque_number);


--
-- Name: cheque_transactions cheque_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cheque_transactions
    ADD CONSTRAINT cheque_transactions_pkey PRIMARY KEY (transaction_id);


--
-- Name: customer_deposit_allocations customer_deposit_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_deposit_allocations
    ADD CONSTRAINT customer_deposit_allocations_pkey PRIMARY KEY (allocation_id);


--
-- Name: customer_deposits customer_deposits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_deposits
    ADD CONSTRAINT customer_deposits_pkey PRIMARY KEY (deposit_id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (customer_id);


--
-- Name: profit_withdrawal_allocations profit_withdrawal_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profit_withdrawal_allocations
    ADD CONSTRAINT profit_withdrawal_allocations_pkey PRIMARY KEY (allocation_id);


--
-- Name: profit_withdrawals profit_withdrawals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profit_withdrawals
    ADD CONSTRAINT profit_withdrawals_pkey PRIMARY KEY (withdrawal_id);


--
-- Name: vendor_payment_allocations vendor_payment_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_payment_allocations
    ADD CONSTRAINT vendor_payment_allocations_pkey PRIMARY KEY (allocation_id);


--
-- Name: vendor_payments vendor_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_payments
    ADD CONSTRAINT vendor_payments_pkey PRIMARY KEY (payment_id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (vendor_id);


--
-- Name: idx_cheque_transactions_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cheque_transactions_customer_id ON public.cheque_transactions USING btree (customer_id);


--
-- Name: idx_cheque_transactions_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cheque_transactions_date ON public.cheque_transactions USING btree (date);


--
-- Name: idx_cheque_transactions_vendor_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cheque_transactions_vendor_id ON public.cheque_transactions USING btree (vendor_id);


--
-- Name: idx_customer_deposit_allocations_deposit_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_deposit_allocations_deposit_id ON public.customer_deposit_allocations USING btree (deposit_id);


--
-- Name: idx_customer_deposit_allocations_transaction_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_deposit_allocations_transaction_id ON public.customer_deposit_allocations USING btree (transaction_id);


--
-- Name: idx_customer_deposits_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_deposits_customer_id ON public.customer_deposits USING btree (customer_id);


--
-- Name: idx_profit_withdrawal_allocations_transaction_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profit_withdrawal_allocations_transaction_id ON public.profit_withdrawal_allocations USING btree (transaction_id);


--
-- Name: idx_profit_withdrawal_allocations_withdrawal_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profit_withdrawal_allocations_withdrawal_id ON public.profit_withdrawal_allocations USING btree (withdrawal_id);


--
-- Name: idx_vendor_payment_allocations_payment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendor_payment_allocations_payment_id ON public.vendor_payment_allocations USING btree (payment_id);


--
-- Name: idx_vendor_payment_allocations_transaction_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendor_payment_allocations_transaction_id ON public.vendor_payment_allocations USING btree (transaction_id);


--
-- Name: idx_vendor_payments_vendor_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendor_payments_vendor_id ON public.vendor_payments USING btree (vendor_id);


--
-- Name: customer_deposits allocate_customer_deposit_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER allocate_customer_deposit_trigger AFTER INSERT ON public.customer_deposits FOR EACH ROW EXECUTE FUNCTION public.allocate_customer_deposit();


--
-- Name: profit_withdrawals allocate_profit_withdrawal_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER allocate_profit_withdrawal_trigger AFTER INSERT ON public.profit_withdrawals FOR EACH ROW EXECUTE FUNCTION public.allocate_profit_withdrawal();


--
-- Name: vendor_payments allocate_vendor_payment_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER allocate_vendor_payment_trigger AFTER INSERT ON public.vendor_payments FOR EACH ROW EXECUTE FUNCTION public.allocate_vendor_payment();


--
-- Name: cheque_transactions calculate_transaction_fields_on_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER calculate_transaction_fields_on_insert BEFORE INSERT ON public.cheque_transactions FOR EACH ROW EXECUTE FUNCTION public.calculate_transaction_fields();


--
-- Name: cheque_transactions calculate_transaction_fields_on_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER calculate_transaction_fields_on_update BEFORE UPDATE OF customer_id, cheque_amount, vendor_id ON public.cheque_transactions FOR EACH ROW WHEN (((old.customer_id IS DISTINCT FROM new.customer_id) OR (old.cheque_amount IS DISTINCT FROM new.cheque_amount) OR ((old.vendor_id)::text IS DISTINCT FROM (new.vendor_id)::text))) EXECUTE FUNCTION public.calculate_transaction_fields();


--
-- Name: vendors set_vendor_id; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_vendor_id BEFORE INSERT ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.generate_vendor_id();


--
-- Name: customer_deposits update_customer_deposits_modtime; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_customer_deposits_modtime BEFORE UPDATE ON public.customer_deposits FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: customers update_customers_modtime; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_customers_modtime BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: profit_withdrawals update_profit_withdrawals_modtime; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_profit_withdrawals_modtime BEFORE UPDATE ON public.profit_withdrawals FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: cheque_transactions update_transactions_modtime; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_transactions_modtime BEFORE UPDATE ON public.cheque_transactions FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: vendor_payments update_vendor_payments_modtime; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_vendor_payments_modtime BEFORE UPDATE ON public.vendor_payments FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: vendors update_vendors_modtime; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_vendors_modtime BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: cheque_transactions cheque_transactions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cheque_transactions
    ADD CONSTRAINT cheque_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id);


--
-- Name: cheque_transactions cheque_transactions_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cheque_transactions
    ADD CONSTRAINT cheque_transactions_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(vendor_id);


--
-- Name: customer_deposit_allocations customer_deposit_allocations_deposit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_deposit_allocations
    ADD CONSTRAINT customer_deposit_allocations_deposit_id_fkey FOREIGN KEY (deposit_id) REFERENCES public.customer_deposits(deposit_id) ON DELETE CASCADE;


--
-- Name: customer_deposit_allocations customer_deposit_allocations_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_deposit_allocations
    ADD CONSTRAINT customer_deposit_allocations_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.cheque_transactions(transaction_id) ON DELETE CASCADE;


--
-- Name: customer_deposits customer_deposits_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_deposits
    ADD CONSTRAINT customer_deposits_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id);


--
-- Name: profit_withdrawal_allocations profit_withdrawal_allocations_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profit_withdrawal_allocations
    ADD CONSTRAINT profit_withdrawal_allocations_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.cheque_transactions(transaction_id) ON DELETE CASCADE;


--
-- Name: profit_withdrawal_allocations profit_withdrawal_allocations_withdrawal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profit_withdrawal_allocations
    ADD CONSTRAINT profit_withdrawal_allocations_withdrawal_id_fkey FOREIGN KEY (withdrawal_id) REFERENCES public.profit_withdrawals(withdrawal_id) ON DELETE CASCADE;


--
-- Name: vendor_payment_allocations vendor_payment_allocations_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_payment_allocations
    ADD CONSTRAINT vendor_payment_allocations_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.vendor_payments(payment_id) ON DELETE CASCADE;


--
-- Name: vendor_payment_allocations vendor_payment_allocations_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_payment_allocations
    ADD CONSTRAINT vendor_payment_allocations_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.cheque_transactions(transaction_id) ON DELETE CASCADE;


--
-- Name: vendor_payments vendor_payments_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_payments
    ADD CONSTRAINT vendor_payments_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(vendor_id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION allocate_customer_deposit(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.allocate_customer_deposit() TO anon;
GRANT ALL ON FUNCTION public.allocate_customer_deposit() TO authenticated;
GRANT ALL ON FUNCTION public.allocate_customer_deposit() TO service_role;


--
-- Name: FUNCTION allocate_profit_withdrawal(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.allocate_profit_withdrawal() TO anon;
GRANT ALL ON FUNCTION public.allocate_profit_withdrawal() TO authenticated;
GRANT ALL ON FUNCTION public.allocate_profit_withdrawal() TO service_role;


--
-- Name: FUNCTION allocate_vendor_payment(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.allocate_vendor_payment() TO anon;
GRANT ALL ON FUNCTION public.allocate_vendor_payment() TO authenticated;
GRANT ALL ON FUNCTION public.allocate_vendor_payment() TO service_role;


--
-- Name: FUNCTION calculate_transaction_fields(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.calculate_transaction_fields() TO anon;
GRANT ALL ON FUNCTION public.calculate_transaction_fields() TO authenticated;
GRANT ALL ON FUNCTION public.calculate_transaction_fields() TO service_role;


--
-- Name: FUNCTION generate_vendor_id(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.generate_vendor_id() TO anon;
GRANT ALL ON FUNCTION public.generate_vendor_id() TO authenticated;
GRANT ALL ON FUNCTION public.generate_vendor_id() TO service_role;


--
-- Name: FUNCTION update_modified_column(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_modified_column() TO anon;
GRANT ALL ON FUNCTION public.update_modified_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_modified_column() TO service_role;


--
-- Name: TABLE cheque_transactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.cheque_transactions TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.cheque_transactions TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.cheque_transactions TO service_role;


--
-- Name: TABLE customers; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.customers TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.customers TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.customers TO service_role;


--
-- Name: TABLE vendors; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendors TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendors TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendors TO service_role;


--
-- Name: TABLE business_summary; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.business_summary TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.business_summary TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.business_summary TO service_role;


--
-- Name: SEQUENCE cheque_transactions_transaction_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.cheque_transactions_transaction_id_seq TO anon;
GRANT ALL ON SEQUENCE public.cheque_transactions_transaction_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.cheque_transactions_transaction_id_seq TO service_role;


--
-- Name: TABLE customer_balances; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.customer_balances TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.customer_balances TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.customer_balances TO service_role;


--
-- Name: TABLE customer_deposit_allocations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.customer_deposit_allocations TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.customer_deposit_allocations TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.customer_deposit_allocations TO service_role;


--
-- Name: SEQUENCE customer_deposit_allocations_allocation_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.customer_deposit_allocations_allocation_id_seq TO anon;
GRANT ALL ON SEQUENCE public.customer_deposit_allocations_allocation_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.customer_deposit_allocations_allocation_id_seq TO service_role;


--
-- Name: TABLE customer_deposits; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.customer_deposits TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.customer_deposits TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.customer_deposits TO service_role;


--
-- Name: TABLE customer_deposit_allocations_detail; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.customer_deposit_allocations_detail TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.customer_deposit_allocations_detail TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.customer_deposit_allocations_detail TO service_role;


--
-- Name: SEQUENCE customer_deposits_deposit_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.customer_deposits_deposit_id_seq TO anon;
GRANT ALL ON SEQUENCE public.customer_deposits_deposit_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.customer_deposits_deposit_id_seq TO service_role;


--
-- Name: TABLE customer_deposits_summary; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.customer_deposits_summary TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.customer_deposits_summary TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.customer_deposits_summary TO service_role;


--
-- Name: TABLE customer_detailed_transactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.customer_detailed_transactions TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.customer_detailed_transactions TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.customer_detailed_transactions TO service_role;


--
-- Name: SEQUENCE customers_customer_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.customers_customer_id_seq TO anon;
GRANT ALL ON SEQUENCE public.customers_customer_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.customers_customer_id_seq TO service_role;


--
-- Name: TABLE daily_profit_summary; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.daily_profit_summary TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.daily_profit_summary TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.daily_profit_summary TO service_role;


--
-- Name: TABLE monthly_profit_summary; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.monthly_profit_summary TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.monthly_profit_summary TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.monthly_profit_summary TO service_role;


--
-- Name: TABLE outstanding_balances; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.outstanding_balances TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.outstanding_balances TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.outstanding_balances TO service_role;


--
-- Name: TABLE profit_by_customer; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profit_by_customer TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profit_by_customer TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profit_by_customer TO service_role;


--
-- Name: TABLE profit_by_vendor; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profit_by_vendor TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profit_by_vendor TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profit_by_vendor TO service_role;


--
-- Name: TABLE profit_withdrawal_allocations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profit_withdrawal_allocations TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profit_withdrawal_allocations TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profit_withdrawal_allocations TO service_role;


--
-- Name: SEQUENCE profit_withdrawal_allocations_allocation_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.profit_withdrawal_allocations_allocation_id_seq TO anon;
GRANT ALL ON SEQUENCE public.profit_withdrawal_allocations_allocation_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.profit_withdrawal_allocations_allocation_id_seq TO service_role;


--
-- Name: TABLE profit_withdrawals; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profit_withdrawals TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profit_withdrawals TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profit_withdrawals TO service_role;


--
-- Name: SEQUENCE profit_withdrawals_withdrawal_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.profit_withdrawals_withdrawal_id_seq TO anon;
GRANT ALL ON SEQUENCE public.profit_withdrawals_withdrawal_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.profit_withdrawals_withdrawal_id_seq TO service_role;


--
-- Name: TABLE transaction_status_report; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.transaction_status_report TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.transaction_status_report TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.transaction_status_report TO service_role;


--
-- Name: TABLE vendor_balances; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendor_balances TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendor_balances TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendor_balances TO service_role;


--
-- Name: TABLE vendor_detailed_transactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendor_detailed_transactions TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendor_detailed_transactions TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendor_detailed_transactions TO service_role;


--
-- Name: SEQUENCE vendor_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.vendor_id_seq TO anon;
GRANT ALL ON SEQUENCE public.vendor_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.vendor_id_seq TO service_role;


--
-- Name: TABLE vendor_payment_allocations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendor_payment_allocations TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendor_payment_allocations TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendor_payment_allocations TO service_role;


--
-- Name: SEQUENCE vendor_payment_allocations_allocation_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.vendor_payment_allocations_allocation_id_seq TO anon;
GRANT ALL ON SEQUENCE public.vendor_payment_allocations_allocation_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.vendor_payment_allocations_allocation_id_seq TO service_role;


--
-- Name: TABLE vendor_payments; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendor_payments TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendor_payments TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendor_payments TO service_role;


--
-- Name: TABLE vendor_payment_allocations_detail; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendor_payment_allocations_detail TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendor_payment_allocations_detail TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendor_payment_allocations_detail TO service_role;


--
-- Name: SEQUENCE vendor_payments_payment_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.vendor_payments_payment_id_seq TO anon;
GRANT ALL ON SEQUENCE public.vendor_payments_payment_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.vendor_payments_payment_id_seq TO service_role;


--
-- Name: TABLE vendor_payments_summary; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendor_payments_summary TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendor_payments_summary TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.vendor_payments_summary TO service_role;


--
-- Name: TABLE weekly_profit_summary; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.weekly_profit_summary TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.weekly_profit_summary TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.weekly_profit_summary TO service_role;




