'use strict';

var AbstractConnectionManager = require('../abstract/connection-manager'),
    ConnectionManager, Utils = require('../../utils'),
    Promise = require('../../promise'),
    sequelizeErrors = require('../../errors');

ConnectionManager = function(dialect, sequelize) {
    AbstractConnectionManager.call(this, dialect, sequelize);

    this.sequelize = sequelize;
    this.sequelize.config.port = this.sequelize.config.port || 1521;

    try {
        this.lib = require(sequelize.config.dialectModulePath || 'oracledb');
    } catch (err) {
        throw new Error('Please install oracledb package manually');
    }
};

Utils._.extend(ConnectionManager.prototype, AbstractConnectionManager.prototype);
//old
// ConnectionManager.prototype.connect = function(config) {
//     var self = this;

//     return new Promise(function(resolve, reject) {
//         self.pool.getConnection((err, connection) => {
//             if (err) {
//                 reject(new sequelizeErrors.ConnectionError(err));
//                 return;
//             }

//             resolve(connection);
//         });
//     }).timeout(1980, 'Error: timeout of 2000ms exceeded. Check your configuration and your database.');
// };

ConnectionManager.prototype.connect = function(config) {
    var self = this;

    return new Promise(function(resolve, reject) {
        self.pool.getConnection((err, connection) => {
            if (err) {
               // reject(new sequelizeErrors.ConnectionError(err));
                if (err.code) {
                    switch (err.code) {
                    case 'ECONNREFUSED':
                      reject(new sequelizeErrors.ConnectionRefusedError(err));
                      break;
                    case 'ER_ACCESS_DENIED_ERROR':
                      reject(new sequelizeErrors.AccessDeniedError(err));
                      break;
                    case 'ENOTFOUND':
                      reject(new sequelizeErrors.HostNotFoundError(err));
                      break;
                    case 'EHOSTUNREACH':
                      reject(new sequelizeErrors.HostNotReachableError(err));
                      break;
                    case 'EINVAL':
                      reject(new sequelizeErrors.InvalidConnectionError(err));
                      break;
                    default:
                      reject(new sequelizeErrors.ConnectionError(err));
                      break;
                    }
                  } else {
                    reject(new sequelizeErrors.ConnectionError(err));
                  }
                return;
            }
            if (config.pool.handleDisconnects) {
                // Connection to the MySQL server is usually
                // lost due to either server restart, or a
                // connnection idle timeout (the wait_timeout
                // server variable configures this)
                //
                // See [stackoverflow answer](http://stackoverflow.com/questions/20210522/nodejs-mysql-error-connection-lost-the-server-closed-the-connection)
                connection.on('error', function (err) {
                  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
                    // Remove it from read/write pool
                    self.pool.destroy(connection);
                  }
                });
              }

            resolve(connection);
        });
    }).tap(function (connection) {
        connection.query("SET time_zone = '" + self.sequelize.options.timezone + "'"); /* jshint ignore: line */
      });
    // }).timeout(1980, 'Error: timeout of 2000ms exceeded. Check your configuration and your database.');
};

//old 
// ConnectionManager.prototype.disconnect = function(connection) {
//     return new Promise(function(resolve, reject) {
//         connection.release(function(err) {
//             if (err) {
//                 reject(err);
//             } else {
//                 resolve();
//             }
//         });
//     });
// };


ConnectionManager.prototype.disconnect = function(connection) {
    // Dont disconnect connections with an ended protocol
 // That wil trigger a connection error
 if (connection._protocol._ended) {
   return Promise.resolve();
 }

   return new Promise(function(resolve, reject) {
       connection.release(function(err) {
           if (err) {
               return reject(new sequelizeErrors.ConnectionError(err));
           } else {
               resolve();
           }
       });
   });
};

// ConnectionManager.prototype.validate = function(connection) {
//     return true;
// };


ConnectionManager.prototype.validate = function(connection) {
    return connection && ['disconnected', 'protocol_error'].indexOf(connection.state) === -1;
};

ConnectionManager.prototype.getConnection = function(options) {
    var self = this;
    options = options || {};
    var count = 1;
    // this.pool._logStats();
    
    function checkIfPoolDefined(callback) {
     try {
             if(self.pool) {
            { callback() }
        }
        else {
            console.log("Waiting for pool..."+count++)
            setTimeout(function() {
                checkIfPoolDefined(callback);
            }, 250);
        }
     } catch (error) {
        console.log(error)
        setTimeout(function() {
            checkIfPoolDefined(callback);
        }, 250);
     }
    }

    return new Promise(function(resolve, reject) {
      try {
        checkIfPoolDefined(function() {
            self.pool.getConnection((err, connection) => {
                console.log('Starting to establish a connection. . . . . ');
                if (err) {
                 //  reject(err);
                    return;
                }
                console.log('Connection was successful!');
                    resolve(connection);
            });

        })
      } catch (error) {
        console.log(error)
      }
    })
    //.timeout(1980, 'Error: timeout of 2000ms exceeded. Check your configuration and your database.');
};

module.exports = ConnectionManager;