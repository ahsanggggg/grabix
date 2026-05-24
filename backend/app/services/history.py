def get_history_helpers():
    from app.services.db_helpers import init_db, get_db_connection, db_insert, db_update_status

    return {
        "init_db": init_db,
        "get_db_connection": get_db_connection,
        "db_insert": db_insert,
        "db_update_status": db_update_status,
    }
