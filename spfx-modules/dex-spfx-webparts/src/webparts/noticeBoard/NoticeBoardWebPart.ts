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

import * as strings from 'NoticeBoardWebPartStrings';
import NoticeBoard from './components/NoticeBoard';
import { INoticeBoardProps } from './components/INoticeBoardProps';

export interface INoticeBoardWebPartProps {
  title: string;
  listTitle: string;
  pageSize: number;
}

export default class NoticeBoardWebPart extends BaseClientSideWebPart<INoticeBoardWebPartProps> {

  public render(): void {
    const element: React.ReactElement<INoticeBoardProps> = React.createElement(
      NoticeBoard,
      {
        title: this.properties.title || strings.DefaultTitle,
        listTitle: this.properties.listTitle || strings.DefaultListTitle,
        pageSize: this.properties.pageSize || 10,
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
                  label: strings.ListTitleFieldLabel,
                  description: strings.ListTitleFieldDescription
                }),
                PropertyPaneSlider('pageSize', {
                  label: strings.PageSizeFieldLabel,
                  min: 5,
                  max: 30,
                  step: 5
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
