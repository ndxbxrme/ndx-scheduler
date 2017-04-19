(function() {
  'use strict';
  var alasql;

  alasql = require('alasql');

  module.exports = function(ndx) {
    var insertScheduleItem, needsRefresh, parseDate, running, tasks, tick;
    tasks = [];
    needsRefresh = false;
    running = true;
    alasql('CREATE DATABASE scheduler');
    alasql('USE scheduler');
    alasql('CREATE TABLE schedule');
    alasql.MAXSQLCACHESIZE = 50;
    parseDate = function(dateObj, task, start) {
      var i, item, len, now, output, type;
      output = [];
      type = Object.prototype.toString.call(dateObj);
      if (type === '[object Array]') {
        for (i = 0, len = dateObj.length; i < len; i++) {
          item = dateObj[i];
          output = output.concat(parseDate(item, task));
        }
      }
      if (type === '[object Number]') {
        if (dateObj < 65700000000) {
          if (!start) {
            start = new Date(2017, 0, 1).valueOf();
            now = new Date().valueOf();
            if (!task.refreshAt || task.refreshAt < now) {
              task.refreshAt = now + (dateObj * 10) + 5000;
            }
            start = now - ((now - start) % dateObj);
            while (start < task.refreshAt) {
              if (start > now) {
                output.push(start);
              }
              start += dateObj;
            }
          }
        } else {
          if (dateObj > new Date().valueOf()) {
            output.push(dateObj);
          }
        }
      }
      if (type === '[object Date]') {
        if (dateObj.valueOf() > new Date().valueOf()) {
          output.push(dateObj.valueOf());
        }
      }
      return output;
    };
    insertScheduleItem = function(date, data, taskId, cb) {
      return alasql('INSERT INTO schedule VALUES ?', [
        {
          date: date,
          taskId: taskId,
          data: data,
          cb: cb
        }
      ]);
    };
    tick = function() {
      var date, dates, i, item, j, k, l, len, len1, len2, len3, len4, m, obj, ref, task, toCall, toCalls, type;
      if (running) {
        for (i = 0, len = tasks.length; i < len; i++) {
          task = tasks[i];
          if (task.refreshAt < new Date().valueOf()) {
            obj = task.task();
            type = Object.prototype.toString.call(obj);
            alasql('DELETE FROM schedule WHERE taskId=?', [task.id]);
            if (type === '[object Array]') {
              for (j = 0, len1 = obj.length; j < len1; j++) {
                item = obj[j];
                task.refreshAt = item.refreshAt;
                ref = parseDate(item.date, task);
                for (k = 0, len2 = ref.length; k < len2; k++) {
                  date = ref[k];
                  insertScheduleItem(date, item.data, task.id, item.callback);
                }
              }
            } else if (type === '[object Object]') {
              task.refreshAt = obj.refreshAt;
              dates = parseDate(obj.date, task);
              for (l = 0, len3 = dates.length; l < len3; l++) {
                date = dates[l];
                insertScheduleItem(date, obj.data, task.id, obj.callback);
              }
            }
            true;
          }
          toCalls = alasql('SELECT * FROM schedule WHERE date<=?', [new Date().valueOf()]);
          if (toCalls && toCalls.length) {
            for (m = 0, len4 = toCalls.length; m < len4; m++) {
              toCall = toCalls[m];
              if (typeof toCall.cb === "function") {
                toCall.cb(toCall.data);
              }
            }
            alasql('DELETE FROM schedule WHERE taskId=? and date=?', [task.id, toCall.date]);
          }
        }
      }
      return setTimeout(tick, 1000);
    };
    tick();
    return ndx.scheduler = {
      task: function(task) {
        if (task) {
          return tasks.push({
            task: task,
            refreshAt: 0,
            id: ndx.generateID()
          });
        }
      }
    };
  };

}).call(this);

//# sourceMappingURL=index.js.map
