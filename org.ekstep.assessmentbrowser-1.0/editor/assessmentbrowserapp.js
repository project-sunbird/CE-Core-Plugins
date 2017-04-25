'use strict';

angular.module('assessmentbrowserapp', [])
    .controller('assessmentbrowsercontroller', ['$scope', '$injector', 'instance', function($scope, $injector, instance) {
        ecEditor.jQuery('.modal').addClass('item-activity');
        var config = { "showStartPage": false, "showEndPage": false },
            ctrl = this,
            itemIframe;

        ctrl.isAdvanceOptionOpen = true;
        ctrl.isMyQuestions = false;
        ctrl.errorMessage = false;
        ctrl.languagecode = 'en';
        ctrl.activePreviewItem = '';
        ctrl.assessment = {};
        ctrl.activity = {
            'title': '',
            'qlevel': '',
            'type': '',
            'language': 'English',
            'gradeLevel': '',
            'conceptIds': []
        };
        ctrl.activityOptions = {
            title: "",
            shuffle: false,
            showImmediateFeedback: true,
            myQuestions: false,
            concepts: '(0) Concepts'
        };
        ctrl.context = ecEditor.getAngularScope().context;

        //get languages from languages api
        ecEditor.getService('language').getLanguages(function(err, respLan) {
            if (!err) {
                var assessmentlanguages = {};
                ecEditor._.forEach(respLan.data.result.languages, function(lang) {
                    assessmentlanguages[lang.code] = lang.name;
                });
                ctrl.assessment.language = ecEditor._.values(assessmentlanguages);
                //get questiontype, grade and difficulty dropdown values from definitions api
                ecEditor.getService('meta').getDefinitions('AssessmentItem', function(err, resp) {
                    if (!err) {
                        var questionTypes = {};
                        ecEditor._.forEach(resp.data.result.definition_node.properties, function(prop) {
                            switch (prop.propertyName) {
                                case "qlevel":
                                    ctrl.assessment.qlevel = prop.range;
                                    break;
                                case "gradeLevel":
                                    ctrl.assessment.gradeLevel = prop.range;
                                    break;
                                case "type":
                                    ctrl.assessment.type = prop.range;
                                    break;
                            }
                        });
                        //get question type full defination from resource bundles api
                        ecEditor.getService('meta').getResourceBundles(ctrl.languagecode, function(err, resourceResp) {
                            if (!err) {
                                ecEditor._.forEach(ctrl.assessment.type, function(data) {
                                    if (resourceResp.data.result.en[data] == undefined) {
                                        questionTypes[data] = data;
                                    } else {
                                        questionTypes[data] = resourceResp.data.result.en[data];
                                    }
                                });
                                ctrl.assessment.type = questionTypes;
                                $scope.$safeApply();
                            }else{
                                ctrl.errorMessage = true;
                                $scope.$safeApply();
                                return;
                            }
                        });
                        ecEditor.jQuery('.ui.dropdown.lableCls').dropdown({ useLabels: false, forceSelection: false});
                    }else{
                        ctrl.errorMessage = true;
                        $scope.$safeApply();
                        return;
                    }
                });
            }else{
                ctrl.errorMessage = true;
                $scope.$safeApply();
                return;
            }
        });

        ctrl.searchQuestions = function() {
            var activity = ctrl.activity;
            ctrl.isItemAvailable = true;
            ctrl.itemsLoading = true;
            var data = {
                request: {
                    filters: {
                        objectType: ["AssessmentItem"],
                        status: [],
                    },

                    sort_by: { "name": "desc" },
                    limit: 200
                }
            };
            if (ctrl.activityOptions.myQuestions) {
                ctrl.isMyQuestions = true;
                data.request.filters.portalOwner = ecEditor._.isUndefined(ctrl.context) ? '' : ctrl.context.user.id;
            } else {
                ctrl.isMyQuestions = false;
            }
            // setting filters values and title to request data
            ecEditor._.forEach(activity, function(value, key) {
                if (value) {
                    switch (key) {
                        case "question_title":
                            data.request.query = value;
                            break;
                        case "gradeLevel":
                            if (value.length) {
                                data.request.filters.gradeLevel = value;
                            }
                            break;
                        case "language":
                            data.request.filters.language = [value];
                            break;
                        case "qlevel":
                            data.request.filters.qlevel = value;
                            break;
                        case "type":
                            if (value.length) {
                                data.request.filters.type = value;
                            }
                            break;
                        case "concepts":
                            data.request.filters.concepts = value;
                            break;
                    }
                }
            });
            // get Questions from questions api
            ecEditor.getService('assessment').getQuestions(data, function(err, resp) {
                if (!err) {
                    ctrl.itemsLoading = false;
                    var item;
                    ctrl.items = [];
                    if (!resp.data.result.count || resp.data.result.count <= 0) {
                        ctrl.isItemAvailable = false;
                    } else {
                        ecEditor._.forEach(resp.data.result.items, function(value) {
                            if(!ecEditor._.isUndefined(value.template_id)){
                                item = {};
                                item.question = value;
                                if (ecEditor._.findIndex(ctrl.cart.items, function(i) {
                                        return i.question.identifier === value.identifier
                                    }) === -1) {
                                    item.isSelected = false;
                                } else {
                                    item.isSelected = true;
                                }
                                ctrl.items.push(item);
                            }
                        });
                        ctrl.previewItem(ctrl.items[0]);
                    }
                    ctrl.totalItems = ctrl.items.length;
                    $scope.$safeApply();
                } else {
                    ctrl.itemsLoading = false;
                    ctrl.errorMessage = true;
                    $scope.$safeApply();
                    return;
                }
            });
        };

        ctrl.cart = {
            "items": [],
            "getItemIndex": function(item) {
                return ecEditor._.findIndex(ctrl.items, function(i) {
                    return i.question.identifier === item.question.identifier
                });
            },
            "add": function(item) {
                this.items.push(item);
                var itemIndex = this.getItemIndex(item);
                ctrl.items[itemIndex].isSelected = true;
                ctrl.previewItem(item, true);
                $scope.$safeApply();
            },
            "remove": function(item) {
                ecEditor._.remove(this.items, function(cartItem) {
                    return item.question.identifier == cartItem.question.identifier;
                });
                var itemIndex = this.getItemIndex(item);
                if (itemIndex != -1) ctrl.items[itemIndex].isSelected = false;
                ecEditor.jQuery(".displayCount #total_items option[value='number:"+(parseInt(this.items.length+1))+"']").remove();
                ctrl.activityOptions.total_items = this.items.length;
                ecEditor.jQuery('.displayCount .text').html(ctrl.activityOptions.total_items);
                $scope.$safeApply();
            }
        };

        ctrl.addActivityOptions = function() {
            ctrl.isAdvanceOptionOpen = false;
            ctrl.activityOptions.total_items = ctrl.cart.items.length;
            ctrl.activityOptions.max_score = ctrl.activityOptions.total_items;
            ctrl.activityOptions.range = ecEditor._.times(ctrl.activityOptions.total_items).splice(1);
            ctrl.activityOptions.range.push(ctrl.activityOptions.total_items);
            ecEditor.jQuery('.displayCount .text').html(ctrl.activityOptions.total_items);
            $scope.$safeApply();
        };

        $scope.$on('ngDialog.opened', function (e, $dialog) {
            itemIframe = org.ekstep.contenteditor.jQuery('#itemIframe')[0];
            if (itemIframe.src == "")
                itemIframe.src = instance.previewURL;
            itemIframe.addEventListener('load', function() {
                itemIframe.contentWindow.setContentData(null, ctrl.itemPreviewContent, config);
            });
        });
      
        ctrl.previewItem = function(item) {
            ecEditor.getService('assessment').getItem(item.question.identifier, function(err, resp) {
                if (!err) {
                    item = resp.data.result.assessment_item ? resp.data.result.assessment_item : item;
                    ctrl.itemPreviewLoading = true;
                    ctrl.itemPreviewDisplay = "";
                    ctrl.activePreviewItem = item.identifier;
                    var templateRef = item.template_id ? item.template_id : item.template;
                    if (templateRef) {
                        ecEditor.getService('assessment').getTemplate(templateRef, function(err, response) {
                            if (!err) {
                                var x2js = new X2JS({ attributePrefix: 'none', enableToStringFunc: false });
                                var templateJson = x2js.xml_str2json(response.data.result.content.body);
                                ctrl.itemPreviewContent = assessmentBrowserUtil.getQuestionPreviwContent(templateJson, item);
                                ctrl.itemPreviewDisplay = !ecEditor._.isUndefined(ctrl.itemPreviewContent.error) ? ctrl.itemPreviewContent.error : '';
                                ctrl.itemPreviewLoading = false;
                                itemIframe.contentWindow.location.reload();
                                $scope.$safeApply();
                            } else {
                                ctrl.itemPreviewContent = { "error": 'Preview could not be shown.' };
                                ctrl.itemPreviewDisplay = ctrl.itemPreviewContent.error;
                                ctrl.itemPreviewLoading = false;
                                ctrl.errorMessage = true;
                                $scope.$safeApply();
                                return;
                            }
                        });
                    } else {
                        ctrl.itemPreviewContent = { "error": 'Item does not have a template selected.' };
                        ctrl.itemPreviewDisplay = ctrl.itemPreviewContent.error;
                        ctrl.itemPreviewLoading = false;
                        $scope.$safeApply();
                    }
                }else{
                    ctrl.errorMessage = true;
                    $scope.$safeApply();
                    return;
                }
            });

        };

        ctrl.addItemActivity = function() {
            if (!ecEditor._.isUndefined(instance.callback)) {
                instance.callback(ctrl.cart.items, ctrl.activityOptions);
                ctrl.cancel();
            }
        }

        ctrl.cancel = function() {
            $scope.closeThisDialog();
        };

        ctrl.searchQuestions();
        ecEditor.dispatchEvent('org.ekstep.conceptselector:init', {
            element: 'assessmentConceptSelector',
            selectedConcepts: [], // All composite keys except mediaType
            callback: function(data) {
                ctrl.activityOptions.concepts = '(' + data.length + ') concepts selected';
                ctrl.activity.concepts = _.map(data, function(concept) {
                    return concept.id;
                });
                $scope.$safeApply();
                ctrl.searchQuestions();
                console.log('concepts data received - ', ctrl.activity.concepts);
            }
        });

        ctrl.generateTelemetry = function(data) {
          if (data) ecEditor.getService('telemetry').interact({ "type": data.type, "subtype": data.subtype, "target": data.target, "pluginid": instance.manifest.id, "pluginver": instance.manifest.ver, "objectid": "", "stage": ecEditor.getCurrentStage().id })
        }
    }]);
//# sourceURL=assessmentbrowserapp.js
