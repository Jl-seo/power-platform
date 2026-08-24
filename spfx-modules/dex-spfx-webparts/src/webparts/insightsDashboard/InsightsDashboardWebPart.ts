import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField,
  PropertyPaneSlider
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IReadonlyTheme } from '@microsoft/sp-component-base';

import * as strings from 'InsightsDashboardWebPartStrings';
import InsightsDashboard from './components/InsightsDashboard';
import { IInsightsDashboardProps } from './components/IInsightsDashboardProps';

export interface IInsightsDashboardWebPartProps {
  title: string;
  listTitle: string;
  libraryTitle: string;
  monthsBack: number;
}

export default class InsightsDashboardWebPart extends BaseClientSideWebPart<IInsightsDashboardWebPartProps> {

  public render(): void {
    const element: React.ReactElement<IInsightsDashboardProps> = React.createElement(
      InsightsDashboard,
      {
        title: this.properties.title || strings.DefaultTitle,
        listTitle: this.properties.listTitle || strings.DefaultListTitle,
        libraryTitle: this.properties.libraryTitle || strings.DefaultLibraryTitle,
        monthsBack: this.properties.monthsBack || 6,
        webUrl: this.context.pageContext.web.absoluteUrl,
        spHttpClient: this.context.spHttpClient
      }
    );

    ReactDom.render(element, this.domElement);
  }

  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    if (!currentTheme) {
      return;
    }

    const { semanticColors } = currentTheme;

    if (semanticColors) {
      this.domElement.style.setProperty('--bodyText', semanticColors.bodyText || null);
      this.domElement.style.setProperty('--bodyBackground', semanticColors.bodyBackground || null);
      this.domElement.style.setProperty('--link', semanticColors.link || null);
      this.domElement.style.setProperty('--linkHovered', semanticColors.linkHovered || null);
    }
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: {
            description: strings.PropertyPaneDescription
          },
          groups: [
            {
              groupName: strings.BasicGroupName,
              groupFields: [
                PropertyPaneTextField('title', {
                  label: strings.TitleFieldLabel
                }),
                PropertyPaneTextField('listTitle', {
                  label: strings.ListTitleFieldLabel
                }),
                PropertyPaneTextField('libraryTitle', {
                  label: strings.LibraryTitleFieldLabel
                }),
                PropertyPaneSlider('monthsBack', {
                  label: strings.MonthsBackFieldLabel,
                  min: 3,
                  max: 12,
                  step: 1
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
