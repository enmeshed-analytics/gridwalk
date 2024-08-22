interface DataSource {
  id: string;
  name: string;
  connectorType: string;
}

interface DatabaseStrategy {
  listDataSources(userId: string): Promise<DataSource[]>;
}

class DuckDBStrategy implements DatabaseStrategy {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async listDataSources(): Promise<DataSource[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT id, name, connector_type as connectorType 
         FROM data_sources`,
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows as DataSource[]);
          }
        }
      );
    });
  }
}

class DatabaseContext {
  private strategy: DatabaseStrategy;

  constructor(strategy: DatabaseStrategy) {
    this.strategy = strategy;
  }

  async listDataSources(userId: string): Promise<DataSource[]> {
    return this.strategy.listDataSources();
  }
}
