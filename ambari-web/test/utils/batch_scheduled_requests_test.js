/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements. See the NOTICE file distributed with this
 * work for additional information regarding copyright ownership. The ASF
 * licenses this file to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

var App = require('app');
require('utils/helper');
require('views/common/rolling_restart_view');
var batchUtils = require('utils/batch_scheduled_requests');
var modelSetup = require('test/init_model_test');
describe('batch_scheduled_requests', function() {

  beforeEach(function(){
    modelSetup.setupStackServiceComponent();
  });
  afterEach(function(){
    modelSetup.cleanStackServiceComponent();
  });

  describe('#getRollingRestartComponentName', function() {
    var tests = [
      {serviceName: 'HDFS', componentName: 'DATANODE'},
      {serviceName: 'YARN', componentName: 'NODEMANAGER'},
      {serviceName: 'MAPREDUCE', componentName: 'TASKTRACKER'},
      {serviceName: 'HBASE', componentName: 'HBASE_REGIONSERVER'},
      {serviceName: 'STORM', componentName: 'SUPERVISOR'},
      {serviceName: 'SOME_INVALID_SERVICE', componentName: null}
    ];

    tests.forEach(function(test) {
      it(test.serviceName + ' - ' + test.componentName, function() {
        expect(batchUtils.getRollingRestartComponentName(test.serviceName)).to.equal(test.componentName);
      });
    });

  });

  describe('#getBatchesForRollingRestartRequest', function() {
    var tests = [
      {
        hostComponents: Em.A([
          Em.Object.create({componentName:'DATANODE', service:{serviceName:'HDFS'}, host:{hostName:'host1'}}),
          Em.Object.create({componentName:'DATANODE', service:{serviceName:'HDFS'}, host:{hostName:'host2'}}),
          Em.Object.create({componentName:'DATANODE', service:{serviceName:'HDFS'}, host:{hostName:'host3'}})
        ]),
        batchSize: 2,
        m: 'DATANODES on three hosts, batchSize = 2',
        e: {
          batchCount: 2
        }
      },
      {
        hostComponents: Em.A([
          Em.Object.create({componentName:'DATANODE', service:{serviceName:'HDFS'}, host:{hostName:'host1'}}),
          Em.Object.create({componentName:'DATANODE', service:{serviceName:'HDFS'}, host:{hostName:'host2'}}),
          Em.Object.create({componentName:'DATANODE', service:{serviceName:'HDFS'}, host:{hostName:'host3'}})
        ]),
        batchSize: 3,
        m: 'DATANODES on 3 hosts, batchSize = 3',
        e: {
          batchCount: 1
        }
      },
      {
        hostComponents: Em.A([
          Em.Object.create({componentName:'DATANODE', service:{serviceName:'HDFS'}, host:{hostName:'host1'}}),
          Em.Object.create({componentName:'DATANODE', service:{serviceName:'HDFS'}, host:{hostName:'host2'}}),
          Em.Object.create({componentName:'DATANODE', service:{serviceName:'HDFS'}, host:{hostName:'host3'}})
        ]),
        batchSize: 1,
        m: 'DATANODES on 3 hosts, batchSize = 1',
        e: {
          batchCount: 3
        }
      }
    ];

    tests.forEach(function(test) {
      it(test.m, function() {
        expect(batchUtils.getBatchesForRollingRestartRequest(test.hostComponents, test.batchSize).length).to.equal(test.e.batchCount);
      });
    });
  });

  describe('#launchHostComponentRollingRestart', function() {

    beforeEach(function() {
      sinon.spy(batchUtils, 'showRollingRestartPopup');
      sinon.spy(batchUtils, 'showWarningRollingRestartPopup');
    });

    afterEach(function() {
      batchUtils.showRollingRestartPopup.restore();
      batchUtils.showWarningRollingRestartPopup.restore();
    });

    var tests = Em.A([
      {componentName: 'DATANODE', e:{showRollingRestartPopup:true, showWarningRollingRestartPopup:false}},
      {componentName: 'TASKTRACKER', e:{showRollingRestartPopup:true, showWarningRollingRestartPopup:false}},
      {componentName: 'NODEMANAGER', e:{showRollingRestartPopup:true, showWarningRollingRestartPopup:false}},
      {componentName: 'HBASE_REGIONSERVER', e:{showRollingRestartPopup:true, showWarningRollingRestartPopup:false}},
      {componentName: 'SUPERVISOR', e:{showRollingRestartPopup:true, showWarningRollingRestartPopup:false}},
      {componentName: 'SOME_OTHER_COMPONENT', e:{showRollingRestartPopup:false, showWarningRollingRestartPopup:true}}
    ]);

    tests.forEach(function(test) {
      it(test.componentName, function() {
        batchUtils.launchHostComponentRollingRestart(test.componentName);
        expect(batchUtils.showRollingRestartPopup.calledOnce).to.equal(test.e.showRollingRestartPopup);
        expect(batchUtils.showWarningRollingRestartPopup.calledOnce).to.equal(test.e.showWarningRollingRestartPopup);
      });
    });

  });

  describe('#restartHostComponents', function() {

    beforeEach(function() {
      sinon.spy($, 'ajax');
      App.testMode = true;
    });

    afterEach(function() {
      $.ajax.restore();
      App.testMode = false;
    });

    var tests = Em.A([
      {
        hostComponentList: Em.A([
          Em.Object.create({
            componentName: 'n1',
            host: Em.Object.create({
              hostName: 'h1'
            })
          }),
          Em.Object.create({
            componentName: 'n1',
            host: Em.Object.create({
              hostName: 'h2'
            })
          })
        ]),
        e: {
          ajaxCalledOnce: true,
          resource_filters: [{"component_name":"n1","hosts":"h1,h2"}]
        },
        m: '1 component on 2 hosts'
      },
      {
        hostComponentList: Em.A([
          Em.Object.create({
            componentName: 'n1',
            host: Em.Object.create({
              hostName: 'h1'
            })
          }),
          Em.Object.create({
            componentName: 'n1',
            host: Em.Object.create({
              hostName: 'h2'
            })
          }),
          Em.Object.create({
            componentName: 'n2',
            host: Em.Object.create({
              hostName: 'h2'
            })
          })
        ]),
        e: {
          ajaxCalledOnce: true,
          resource_filters: [{"component_name":"n1","hosts":"h1,h2"},{"component_name":"n2","hosts":"h2"}]
        },
        m: '1 component on 2 hosts, 1 on 1 host'
      }
    ]);

    tests.forEach(function(test) {
      it(test.m, function() {
        batchUtils.restartHostComponents(test.hostComponentList);
        expect($.ajax.calledOnce).to.equal(test.e.ajaxCalledOnce);
        expect( JSON.parse($.ajax.args[0][0].data)['Requests/resource_filters']).to.eql(test.e.resource_filters);
      });
    });

    it('Empty data', function() {
      batchUtils.restartHostComponents([]);
      expect($.ajax.called).to.equal(false);
    });

  });

});
