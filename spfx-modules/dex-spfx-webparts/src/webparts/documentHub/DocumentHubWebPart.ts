import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField,
  PropertyPaneSlider,
  PropertyPaneChoiceGroup
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IReadonlyTheme } from '@microsoft/sp-component-base';
import { initializeFileTypeIcons } from '@fluentui/react-file-type-icons';

import * as strings from 'DocumentHubWebPartStrings';
import DocumentHub from './components/DocumentHub';
import { IDocumentHubProps, DocumentHubView } from './components/IDocumentHubProps';

export interface IDocumentHubWebPartProps {
  title: string;
  libraryTitle: string;
  pageSize: number;
  defaultView: DocumentHubView;
}

export default class DocumentHubWebPart extends BaseClientSideWebPart<IDocumentHubWebPartProps> {

  protected onInit(): Promise<void> {
    initializeFileTypeIcons();
    return Promise.resolve();
  }

  public render(): void {
    const element: React.ReactElement<IDocumentHubProps> = React.createElement(
      DocumentHub,
      {
        title: this.properties.title || strings.DefaultTitle,
        libraryTitle: this.properties.libraryTitle || strings.DefaultLibraryTitle,
        pageSize: this.properties.pageSize || 12,
        defaultView: this.properties.defaultView || 'card',
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
                PropertyPaneTextField('libraryTitle', {
                  label: strings.LibraryTitleFieldLabel,
                  description: strings.LibraryTitleFieldDescription
                }),
                PropertyPaneSlider('pageSize', {
                  label: strings.PageSizeFieldLabel,
                  min: 4,
                  max: 24,
                  step: 4
                }),
                PropertyPaneChoiceGroup('defaultView', {
                  label: strings.DefaultViewFieldLabel,
                  options: [
                    { key: 'card', text: strings.CardViewLabel, iconProps: { officeFabricIconFontName: 'GridViewMedium' } },
                    { key: 'table', text: strings.TableViewLabel, iconProps: { officeFabricIconFontName: 'BulletedList' } }
                  ]
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
