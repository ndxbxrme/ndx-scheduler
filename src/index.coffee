'use strict'

alasql = require 'alasql'

module.exports = (ndx) ->
  tasks = []
  needsRefresh = false
  running = true
  alasql 'CREATE DATABASE scheduler'
  alasql 'USE scheduler'
  alasql 'CREATE TABLE schedule'
  alasql.MAXSQLCACHESIZE = 50
  parseDate = (dateObj, task, start) ->
    output = []
    type = Object.prototype.toString.call dateObj
    if type is '[object Array]'
      for item in dateObj
        output = output.concat parseDate item, task
    if type is '[object Number]'
      if dateObj < 65700000000
        if not start
          start = new Date(2017, 0, 1).valueOf()
          now = new Date().valueOf()
          if not task.refreshAt or task.refreshAt < now
            task.refreshAt = now + (dateObj * 10) + 5000
          start = now - ((now - start) % dateObj)
          while start < task.refreshAt
            if start > now
              output.push start
            start += dateObj
      else
        if dateObj > new Date().valueOf()
          output.push dateObj
    if type is '[object Date]'
      if dateObj.valueOf() > new Date().valueOf()
        output.push dateObj.valueOf()
    output
  insertScheduleItem = (date, data, taskId, cb) ->
    alasql 'INSERT INTO schedule VALUES ?', [{
      date: date
      taskId: taskId
      data: data
      cb: cb
    }]
    
  tick = ->
    if running
      for task in tasks
        if task.refreshAt < new Date().valueOf()
          obj = task.task()
          type = Object.prototype.toString.call obj
          alasql 'DELETE FROM schedule WHERE taskId=?', [task.id]
          if type is '[object Array]'
            for item in obj
              task.refreshAt = item.refreshAt
              for date in parseDate item.date, task
                insertScheduleItem date, item.data, task.id, item.callback
          else if type is '[object Object]'
            task.refreshAt = obj.refreshAt
            dates = parseDate obj.date, task
            for date in dates
              insertScheduleItem date, obj.data, task.id, obj.callback
          true
        toCalls = alasql 'SELECT * FROM schedule WHERE date<=?', [new Date().valueOf()]
        if toCalls and toCalls.length
          for toCall in toCalls
            toCall.cb? toCall.data
          alasql 'DELETE FROM schedule WHERE taskId=? and date=?', [task.id, toCall.date]
    setTimeout tick, 1000
  tick()
  ndx.scheduler =
    task: (task) ->
      if task
        tasks.push 
          task: task
          refreshAt: 0
          id: ndx.generateID()

  